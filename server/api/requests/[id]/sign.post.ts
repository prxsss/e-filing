import db from '~~/lib/db';
import { request, requestTemplate, signatureFlow, signatures, userRoles, users } from '~~/lib/db/schema';
import { supabaseAdmin } from '~~/lib/supabase/client';
import { signNotificationService } from '~~/server/services/sign-notification.service';
import { buildFilledPdfBytesForRequest } from '~~/server/utils/build-filled-pdf-for-request';
import { getSignRequestContext } from '~~/server/utils/get-sign-request-context';
import { and, asc, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return { success: false, error: 'Invalid request ID' };
    }

    const body = await readBody(event);
    const { signatureDataUrl, regenerateFilledPdf } = body as {
      signatureDataUrl: string;
      /** When true, rebuild filled PDF from DB in memory (avoids extra HTTP round-trip + re-download after generate-filled-pdf). */
      regenerateFilledPdf?: boolean;
    };
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware

    if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/')) {
      return { success: false, error: 'Invalid signature data' };
    }

    // Enforce a reasonable payload size limit (~1 MB base64 ≈ 750 KB image)
    if (signatureDataUrl.length > 1_048_576) {
      return { success: false, error: 'Signature image is too large (max 1 MB)' };
    }

    // Get user's role IDs
    const userRoleRows = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    const userRoleIds = userRoleRows.map(r => r.roleId);

    // Find current pending flow entry for this request
    const pendingFlows = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.status, 'pending'),
      ))
      .orderBy(asc(signatureFlow.stepOrder))
      .limit(1);

    const flowEntry = pendingFlows[0];

    if (!flowEntry) {
      return { success: false, error: 'No pending signing step found for this request' };
    }

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

    if (!regenerateFilledPdf && !requestData.filledDocumentUrl) {
      return { success: false, error: 'No filled PDF found. Please try again.' };
    }

    // Get template for field coordinates
    const [template] = await db
      .select()
      .from(requestTemplate)
      .where(eq(requestTemplate.id, Number(requestData.templateId)))
      .limit(1);

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // ── Decode signature and embed into PDF ────────────────────────────────
    const base64Data = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const sigBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // ── Load PDF: either rebuild from DB (signer flow) or fetch stored URL ──
    let pdfBytesForSign: Uint8Array;
    if (regenerateFilledPdf) {
      const built = await buildFilledPdfBytesForRequest(requestId, userId);
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

    const assignedIds = (flowEntry.assignedFieldInstanceIds as string[]) ?? [];
    const allFields = (template.placedFieldsData as any[]) ?? [];
    const signatureFields = allFields.filter(
      (f: any) => assignedIds.includes(f.instanceId) && f.type === 'Signature',
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
    const pdfFilename = `request-${requestId}-step-${flowEntry.stepOrder}-${Date.now()}.pdf`;

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
    await db.insert(signatures).values({
      requestId,
      signatureFlowId: flowEntry.id,
      userId,
      fieldInstanceId: assignedIds[0] ?? null,
      pdfHash,
    });

    // Mark current step as signed
    const [updatedFlowEntry] = await db
      .update(signatureFlow)
      .set({ status: 'signed', signedBy: userId, signedAt: new Date().toISOString() })
      .where(eq(signatureFlow.id, flowEntry.id))
      .returning();

    // Get context for notification
    const context = await getSignRequestContext(requestId);

    // ── Advance workflow ─────────────────────────────────────────────────────
    const [nextStep] = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.status, 'waiting'),
      ))
      .orderBy(asc(signatureFlow.stepOrder))
      .limit(1);

    if (nextStep) {
      await db
        .update(signatureFlow)
        .set({ status: 'pending', pendingAt: new Date().toISOString() })
        .where(eq(signatureFlow.id, nextStep.id));

      await db
        .update(request)
        .set({ status: 'in_progress' })
        .where(eq(request.id, requestId));

      // Skip notification for the initial step (student submission).
      // Notifications should only be sent to actual signers (stepOrder > 1).
      if (flowEntry.stepOrder > 1) {
        const [[currentSigner], [nextSigner]] = await Promise.all([

          // Get current signer name for notification
          db.select({
            signerName: sql<string>`
            concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
          `,
          }).from(users).where(eq(users.id, userId)),

          // Get next signer email and name for notification
          db.select({
            signerEmail: users.email,
            signerName: sql<string>`
            concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
          `,
          }).from(users).where(eq(users.id, nextStep.assignedUserId!)),
        ]);

        await Promise.all([

          // Notify requester about the signed step
          signNotificationService.notifySigned({ signerName: currentSigner.signerName, stepOrder: updatedFlowEntry.stepOrder }, context),

          // Notify next signer
          signNotificationService.notifySigner({ signerEmail: nextSigner.signerEmail, signerName: nextSigner.signerName, stepOrder: nextStep.stepOrder }, context),
        ]);
      }

      return {
        success: true,
        data: {
          status: 'in_progress',
          nextRole: nextStep.roleName,
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
