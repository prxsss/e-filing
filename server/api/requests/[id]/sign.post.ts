import db from '~~/lib/db';
import { request, requestTemplate, signatureFlow, signatures, userRoles, users, userSignatures } from '~~/lib/db/schema';
import { supabaseAdmin } from '~~/lib/supabase/client';
import { signNotificationService } from '~~/server/services/sign-notification.service';
import { buildFilledPdfBytesForRequest } from '~~/server/utils/build-filled-pdf-for-request';
import { getSignRequestContext } from '~~/server/utils/get-sign-request-context';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';

function normalizeSignatureDataUrl(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value)
    return '';

  const isDataUrl = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/.test(value);
  if (isDataUrl)
    return value;

  const looksLikeBase64 = /^[A-Z0-9+/=\s]+$/i.test(value) && value.length >= 64;
  if (looksLikeBase64)
    return `data:image/png;base64,${value.replace(/\s+/g, '')}`;

  return '';
}

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return { success: false, error: 'Invalid request ID' };
    }

    const body = await readBody(event);
    const { signatureDataUrl, regenerateFilledPdf, userSignatureId } = body as {
      signatureDataUrl?: string;
      /** When true, rebuild filled PDF from DB in memory (avoids extra HTTP round-trip + re-download after generate-filled-pdf). */
      regenerateFilledPdf?: boolean;
      /** Optional saved signature id owned by current signer. */
      userSignatureId?: number;
    };
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware

    let finalSignatureDataUrl = normalizeSignatureDataUrl(signatureDataUrl);
    let selectedUserSignatureId: number | null = null;

    if (Number.isFinite(Number(userSignatureId)) && Number(userSignatureId) > 0) {
      const wantedId = Number(userSignatureId);
      const [savedSignature] = await db
        .select({
          id: userSignatures.id,
          dataUrl: userSignatures.dataUrl,
        })
        .from(userSignatures)
        .where(and(
          eq(userSignatures.id, wantedId),
          eq(userSignatures.userId, userId),
        ))
        .limit(1);

      if (!savedSignature) {
        return { success: false, error: 'Saved signature not found for current user' };
      }

      finalSignatureDataUrl = normalizeSignatureDataUrl(savedSignature.dataUrl);
      selectedUserSignatureId = savedSignature.id;
    }

    if (!finalSignatureDataUrl) {
      return { success: false, error: 'Invalid signature data' };
    }

    // Enforce a reasonable payload size limit (~1 MB base64 ≈ 750 KB image)
    if (finalSignatureDataUrl.length > 1_048_576) {
      return { success: false, error: 'Signature image is too large (max 1 MB)' };
    }

    // Get user's role IDs
    const userRoleRows = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    const userRoleIds = userRoleRows.map(r => r.roleId);

    // Find all pending flow entries for this request
    // (with parallel signing there can be multiple pending steps at the same order)
    const pendingFlows = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.status, 'pending'),
      ))
      .orderBy(asc(signatureFlow.stepOrder));

    // Find the pending step this user is authorized to sign
    const flowEntry = pendingFlows.find(f =>
      f.assignedUserId === userId
      || (f.assignedUserId === null && userRoleIds.includes(f.roleId)),
    );

    if (!flowEntry) {
      return { success: false, error: 'No pending signing step found for this request' };
    }

    const activeStepOrder = flowEntry.stepOrder;
    const flowEntriesForUserAtActiveStep = pendingFlows.filter((flow) => {
      if (flow.stepOrder !== activeStepOrder) {
        return false;
      }
      return flow.assignedUserId === userId
        || (flow.assignedUserId === null && userRoleIds.includes(flow.roleId));
    });

    // Authorization: mirrors the same dual-pattern routing used in for-signing.get.ts
    //   Pattern A — direct assignment: assignedUserId === me (role not required)
    //   Pattern B — role queue:        assignedUserId is null AND roleId ∈ userRoles
    const isAuthorized
      = flowEntry.assignedUserId === userId
        || (flowEntry.assignedUserId === null && userRoleIds.includes(flowEntry.roleId));

    if (!isAuthorized) {
      return { success: false, error: 'You are not authorized to sign this step' };
    }

    // Get the request record
    const [requestData] = await db
      .select()
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (!requestData) {
      return { success: false, error: 'Request not found' };
    }

    const [template] = await db
      .select()
      .from(requestTemplate)
      .where(eq(requestTemplate.id, Number(requestData.templateId)))
      .limit(1);

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const assignedIds = Array.from(new Set(
      flowEntriesForUserAtActiveStep.flatMap((flow) => {
        const ids = (flow.assignedFieldInstanceIds as string[]) ?? [];
        return ids.map(id => String(id ?? '').trim()).filter(id => id.length > 0);
      }),
    ));
    const allFields = (template.placedFieldsData as any[]) ?? [];
    const pendingStepHasNonSignatureFields = allFields.some(
      (f: any) =>
        assignedIds.includes(f.instanceId)
        && String(f?.type ?? f?.fieldType ?? '').trim().toLowerCase() !== 'signature',
    );
    // Never trust the client alone: if this step includes form fields, we must burn DB values into the PDF.
    const effectiveRegenerateFilledPdf = Boolean(regenerateFilledPdf) || pendingStepHasNonSignatureFields;

    if (!effectiveRegenerateFilledPdf && !requestData.filledDocumentUrl) {
      return { success: false, error: 'No filled PDF found. Please try again.' };
    }

    // ── Decode signature and embed into PDF ────────────────────────────────
    const base64Data = finalSignatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const sigBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // ── Load PDF: incremental update — build on top of the previous PDF ────
    // Each signing step only adds its own form fields to the existing PDF so
    // that earlier signatures and field values are never discarded.
    let pdfBytesForSign: Uint8Array;
    if (effectiveRegenerateFilledPdf) {
      // Collect only the non-signature field instance IDs for this step.
      // Signature fields are drawn separately below; passing them to the
      // renderer would have no effect (no stored text value) but is harmless.
      const nonSigAssignedIds = assignedIds.filter((id) => {
        const f = allFields.find((f: any) => String(f?.instanceId ?? '').trim() === id);
        return f && String(f?.type ?? f?.fieldType ?? '').trim().toLowerCase() !== 'signature';
      });

      // Use the existing filled PDF as base (incremental mode).
      // Fall back to the template only when there is no previous PDF yet
      // (e.g. the very first step where generate-filled-pdf was not called).
      const basePdfUrl = requestData.filledDocumentUrl || template.documentUrl;

      const built = await buildFilledPdfBytesForRequest(requestId, userId, {
        fieldInstanceIdFilter: nonSigAssignedIds,
        basePdfUrl,
      });
      if (!built.success) {
        return { success: false, error: built.error === 'Forbidden' ? 'Not allowed to regenerate PDF' : built.error };
      }
      pdfBytesForSign = built.bytes;
    }
    else {
      const pdfResponse = await fetch(requestData.filledDocumentUrl!);
      if (!pdfResponse.ok) {
        return { success: false, error: 'Failed to fetch current PDF' };
      }
      pdfBytesForSign = new Uint8Array(await pdfResponse.arrayBuffer());
    }

    const PDFLib = await import('pdf-lib');
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytesForSign);
    const pages = pdfDoc.getPages();

    const sigImage = await pdfDoc.embedPng(sigBytes);

    const templateWidth = template.documentWidth || 595;
    const templateHeight = template.documentHeight || 842;

    const signatureFields = allFields.filter(
      (f: any) => {
        const fieldType = String(f?.type ?? f?.fieldType ?? '').trim().toLowerCase();
        return assignedIds.includes(f.instanceId) && fieldType === 'signature';
      },
    );

    for (const field of signatureFields) {
      const pageIndex = (field.pageNumber || 1) - 1;
      const targetPage = pages[pageIndex];
      if (!targetPage)
        continue;

      const { height: pageHeight } = targetPage.getSize();

      let x: number;
      let y: number;
      let width: number;
      let height: number;

      if (field.normalizedX !== undefined) {
        x = field.normalizedX * templateWidth;
        y = field.normalizedY * templateHeight;
        width = field.normalizedWidth * templateWidth;
        height = field.normalizedHeight * templateHeight;
      }
      else {
        x = field.x || 0;
        y = field.y || 0;
        width = field.width || 150;
        height = field.height || 60;
      }

      // PDF coordinate system: y=0 is bottom-left; UI: y=0 is top-left
      targetPage.drawImage(sigImage, {
        x,
        y: pageHeight - y - height,
        width,
        height,
        opacity: 1,
      });
    }

    const signedPdfBytes = await pdfDoc.save();

    // ── Compute SHA-256 integrity hash of the exactly-as-stored PDF ─────────
    const pdfHash = createHash('sha256').update(new Uint8Array(signedPdfBytes)).digest('hex');

    // ── Upload versioned PDF snapshot (one file per signing step) ────────────
    // Each step produces its own immutable snapshot so nothing is ever lost.
    // The request record always points to the latest (most-signed) copy.
    const pdfFilename = `request-${requestId}-step-${activeStepOrder}-${Date.now()}.pdf`;

    const { error: pdfUploadError } = await supabaseAdmin.storage
      .from('filled-requests')
      .upload(pdfFilename, signedPdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '31536000',
        upsert: false,
      });

    if (pdfUploadError) {
      return { success: false, error: `PDF upload failed: ${pdfUploadError.message}` };
    }

    const { data: { publicUrl: signedPdfUrl } } = supabaseAdmin.storage
      .from('filled-requests')
      .getPublicUrl(pdfFilename);

    // Persist updated PDF URL (points to latest signed snapshot)
    await db
      .update(request)
      .set({ filledDocumentUrl: signedPdfUrl })
      .where(eq(request.id, requestId));

    // ── Save audit-quality signature record ──────────────────────────────────
    // Insert one row per signature field instance so the client can render
    // signatures as separate overlays.
    for (const flow of flowEntriesForUserAtActiveStep) {
      const flowAssignedIds = ((flow.assignedFieldInstanceIds as string[]) ?? [])
        .map(id => String(id ?? '').trim())
        .filter(id => id.length > 0);

      const flowSignatureFieldInstanceIds = allFields
        .filter((f: any) => {
          const fieldType = String(f?.type ?? f?.fieldType ?? '').trim().toLowerCase();
          return flowAssignedIds.includes(String(f?.instanceId ?? '').trim()) && fieldType === 'signature';
        })
        .map((f: any) => String(f?.instanceId ?? '').trim())
        .filter((id: string) => id.length > 0);

      if (flowSignatureFieldInstanceIds.length > 0) {
        for (const fieldInstanceId of flowSignatureFieldInstanceIds) {
          await db.insert(signatures).values({
            requestId,
            signatureFlowId: flow.id,
            userId,
            fieldInstanceId: fieldInstanceId ?? null,
            pdfHash,
            dataUrl: signatureDataUrl,
          });
        }
        continue;
      }

      await db.insert(signatures).values({
        requestId,
        signatureFlowId: flow.id,
        userId,
        fieldInstanceId: flowAssignedIds[0] ?? null,
        pdfHash,
        dataUrl: finalSignatureDataUrl,
        userSignatureId: selectedUserSignatureId,
      });
    }

    // Mark all current user's pending entries at this active stage as signed
    await db
      .update(signatureFlow)
      .set({ status: 'signed', signedBy: userId, signedAt: new Date().toISOString() })
      .where(inArray(signatureFlow.id, flowEntriesForUserAtActiveStep.map(flow => flow.id)));

    // Get context for notification
    const context = await getSignRequestContext(requestId);

    // ── Advance workflow ─────────────────────────────────────────────────────
    // With parallel signing: only advance to the next stage when ALL steps
    // at the current order level are signed.
    const siblingsAtSameOrder = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.stepOrder, activeStepOrder),
      ));

    const allSignedAtCurrentOrder = siblingsAtSameOrder.every(s => s.status === 'signed');

    if (!allSignedAtCurrentOrder) {
      // Parallel siblings are still pending — stay in progress, wait for the others
      return {
        success: true,
        data: {
          status: 'in_progress',
          nextRole: null,
          filledDocumentUrl: signedPdfUrl,
        },
      };
    }

    // All parallel siblings are done — activate the next order group
    const nextWaiting = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.status, 'waiting'),
      ))
      .orderBy(asc(signatureFlow.stepOrder))
      .limit(1);

    if (nextWaiting[0]) {
      const nextGroupOrder = nextWaiting[0].stepOrder;

      // Activate ALL steps at this order group simultaneously (parallel)
      await db
        .update(signatureFlow)
        .set({ status: 'pending', pendingAt: new Date().toISOString() })
        .where(and(
          eq(signatureFlow.requestId, requestId),
          eq(signatureFlow.stepOrder, nextGroupOrder),
          eq(signatureFlow.status, 'waiting'),
        ));

      await db
        .update(request)
        .set({ status: 'in_progress' })
        .where(eq(request.id, requestId));

      // Notify all newly-activated signers in the next group
      if (activeStepOrder > 1) {
        const [[currentSigner], nextSigners] = await Promise.all([
          db.select({
            signerName: sql<string>`
            concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
          `,
          }).from(users).where(eq(users.id, userId)),

          db.select({
            signerEmail: users.email,
            signerName: sql<string>`
            concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
          `,
            stepOrder: signatureFlow.stepOrder,
          })
            .from(signatureFlow)
            .innerJoin(users, eq(signatureFlow.assignedUserId, users.id))
            .where(and(
              eq(signatureFlow.requestId, requestId),
              eq(signatureFlow.stepOrder, nextGroupOrder),
            )),
        ]);

        await Promise.all([
          signNotificationService.notifySigned({ signerName: currentSigner.signerName, stepOrder: activeStepOrder }, context),
          ...nextSigners.map(ns =>
            signNotificationService.notifySigner({ signerEmail: ns.signerEmail, signerName: ns.signerName, stepOrder: ns.stepOrder }, context),
          ),
        ]);
      }

      return {
        success: true,
        data: {
          status: 'in_progress',
          nextRole: nextWaiting[0].roleName,
          filledDocumentUrl: signedPdfUrl,
        },
      };
    }
    else {
      await db
        .update(request)
        .set({ status: 'completed', completedAt: new Date().toISOString() })
        .where(eq(request.id, requestId));

      const [{ signerName }] = await db.select({
        signerName: sql<string>`
          concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
        `,
      }).from(users).where(eq(users.id, userId));

      // Notify requester about completion
      await signNotificationService.notifyCompleted(signerName, context);

      return {
        success: true,
        data: {
          status: 'completed',
          filledDocumentUrl: signedPdfUrl,
        },
      };
    }
  }
  catch (error: any) {
    console.error('Error processing signature:', error);
    return { success: false, error: error.message || 'Failed to process signature' };
  }
});
