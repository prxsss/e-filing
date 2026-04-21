import db from '~~/lib/db';
import { notifications, request, requestTemplate, signatureFlow, signatures, userRoles, users, userSignatures } from '~~/lib/db/schema';
import { supabaseAdmin } from '~~/lib/supabase/client';
import { signNotificationService } from '~~/server/services/sign-notification.service';
import { buildFilledPdfBytesForRequest } from '~~/server/utils/build-filled-pdf-for-request';
import { getSignRequestContext } from '~~/server/utils/get-sign-request-context';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
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

function normalizeSignatureEntries(raw: unknown): Array<{ fieldInstanceId: string; signatureDataUrl: string }> {
  if (!Array.isArray(raw)) {
    return [];
  }

  const byInstanceId = new Map<string, string>();

  for (const entry of raw) {
    const fieldInstanceId = String((entry as any)?.fieldInstanceId ?? '').trim();
    if (!fieldInstanceId.length) {
      continue;
    }

    const signatureDataUrl = normalizeSignatureDataUrl((entry as any)?.signatureDataUrl);
    if (!signatureDataUrl.length) {
      continue;
    }

    byInstanceId.set(fieldInstanceId, signatureDataUrl);
  }

  return Array.from(byInstanceId.entries()).map(([fieldInstanceId, signatureDataUrl]) => ({
    fieldInstanceId,
    signatureDataUrl,
  }));
}

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return { success: false, error: 'Invalid request ID' };
    }

    const body = await readBody(event);
    const { signatureDataUrl, regenerateFilledPdf, userSignatureId, signatureEntries } = body as {
      signatureDataUrl?: string;
      signatureEntries?: Array<{ fieldInstanceId?: string; signatureDataUrl?: string }>;
      /** When true, rebuild filled PDF from DB in memory (avoids extra HTTP round-trip + re-download after generate-filled-pdf). */
      regenerateFilledPdf?: boolean;
      /** Optional saved signature id owned by current signer. */
      userSignatureId?: number;
    };
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware

    const normalizedSignatureEntries = normalizeSignatureEntries(signatureEntries);
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

    if (!finalSignatureDataUrl && normalizedSignatureEntries.length === 0) {
      return { success: false, error: 'Invalid signature data' };
    }

    // Enforce a reasonable payload size limit (~1 MB base64 ≈ 750 KB image)
    if (finalSignatureDataUrl.length > 1_048_576) {
      return { success: false, error: 'Signature image is too large (max 1 MB)' };
    }

    for (const entry of normalizedSignatureEntries) {
      if (entry.signatureDataUrl.length > 1_048_576) {
        return { success: false, error: 'Signature image is too large (max 1 MB)' };
      }
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

    const [requestMeta] = await db
      .select({
        templateId: request.templateId,
      })
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (!requestMeta) {
      return { success: false, error: 'Request not found' };
    }

    const [template] = await db
      .select()
      .from(requestTemplate)
      .where(eq(requestTemplate.id, Number(requestMeta.templateId)))
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

    // Collect only the non-signature field instance IDs for this step.
    const nonSigAssignedIds = assignedIds.filter((id) => {
      const f = allFields.find((field: any) => String(field?.instanceId ?? '').trim() === id);
      return f && String(f?.type ?? f?.fieldType ?? '').trim().toLowerCase() !== 'signature';
    });

    const signatureFields = allFields.filter(
      (f: any) => {
        const fieldType = String(f?.type ?? f?.fieldType ?? '').trim().toLowerCase();
        return assignedIds.includes(f.instanceId) && fieldType === 'signature';
      },
    );

    const signatureDataUrlByFieldInstanceId = new Map<string, string>();
    if (normalizedSignatureEntries.length > 0) {
      const normalizedEntriesMap = new Map(
        normalizedSignatureEntries.map(entry => [entry.fieldInstanceId, entry.signatureDataUrl]),
      );

      for (const field of signatureFields) {
        const fieldInstanceId = String(field?.instanceId ?? '').trim();
        if (!fieldInstanceId.length) {
          continue;
        }

        const perFieldSignatureDataUrl = normalizedEntriesMap.get(fieldInstanceId);
        if (!perFieldSignatureDataUrl) {
          return {
            success: false,
            error: `Missing signature for field instance ${fieldInstanceId}`,
          };
        }

        signatureDataUrlByFieldInstanceId.set(fieldInstanceId, perFieldSignatureDataUrl);
      }
    }
    else {
      for (const field of signatureFields) {
        const fieldInstanceId = String(field?.instanceId ?? '').trim();
        if (!fieldInstanceId.length) {
          continue;
        }

        signatureDataUrlByFieldInstanceId.set(fieldInstanceId, finalSignatureDataUrl);
      }
    }

    let signedPdfUrl: string | null = null;
    let pdfHash = '';

    // Handle parallel signers safely: update request.filledDocumentUrl with a
    // compare-and-swap condition and retry against the latest base PDF on conflict.
    const maxMergeAttempts = 3;
    for (let attempt = 1; attempt <= maxMergeAttempts; attempt++) {
      const [requestSnapshot] = await db
        .select({
          filledDocumentUrl: request.filledDocumentUrl,
        })
        .from(request)
        .where(eq(request.id, requestId))
        .limit(1);

      if (!requestSnapshot) {
        return { success: false, error: 'Request not found' };
      }

      const baseFilledDocumentUrl = requestSnapshot.filledDocumentUrl ?? null;
      if (!effectiveRegenerateFilledPdf && !baseFilledDocumentUrl) {
        return { success: false, error: 'No filled PDF found. Please try again.' };
      }

      // ── Load PDF: incremental update — build on top of the previous PDF ────
      let pdfBytesForSign: Uint8Array;
      if (effectiveRegenerateFilledPdf) {
        const basePdfUrl = baseFilledDocumentUrl ?? template.documentUrl ?? undefined;

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
        const pdfResponse = await fetch(baseFilledDocumentUrl!);
        if (!pdfResponse.ok) {
          return { success: false, error: 'Failed to fetch current PDF' };
        }
        pdfBytesForSign = new Uint8Array(await pdfResponse.arrayBuffer());
      }

      const PDFLib = await import('pdf-lib');
      const pdfDoc = await PDFLib.PDFDocument.load(pdfBytesForSign);
      const pages = pdfDoc.getPages();
      const signatureImageCache = new Map<string, any>();

      const templateWidth = template.documentWidth || 595;
      const templateHeight = template.documentHeight || 842;

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

        const fieldInstanceId = String(field?.instanceId ?? '').trim();
        const dataUrl = signatureDataUrlByFieldInstanceId.get(fieldInstanceId) || finalSignatureDataUrl;
        if (!dataUrl) {
          continue;
        }

        let sigImage = signatureImageCache.get(dataUrl);
        if (!sigImage) {
          const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
          const sigBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          sigImage = await pdfDoc.embedPng(sigBytes);
          signatureImageCache.set(dataUrl, sigImage);
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
      const nextPdfHash = createHash('sha256').update(new Uint8Array(signedPdfBytes)).digest('hex');

      // Each step produces its own immutable snapshot so nothing is ever lost.
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

      const { data: { publicUrl: candidateSignedPdfUrl } } = supabaseAdmin.storage
        .from('filled-requests')
        .getPublicUrl(pdfFilename);

      const whereCondition = baseFilledDocumentUrl === null
        ? and(eq(request.id, requestId), isNull(request.filledDocumentUrl))
        : and(eq(request.id, requestId), eq(request.filledDocumentUrl, baseFilledDocumentUrl));

      const updatedRequest = await db
        .update(request)
        .set({ filledDocumentUrl: candidateSignedPdfUrl })
        .where(whereCondition)
        .returning({ id: request.id });

      if (updatedRequest.length > 0) {
        signedPdfUrl = candidateSignedPdfUrl;
        pdfHash = nextPdfHash;
        break;
      }

      if (attempt === maxMergeAttempts) {
        return {
          success: false,
          error: 'Another signer updated this request at the same time. Please sign again.',
        };
      }
    }

    if (!signedPdfUrl || !pdfHash) {
      return {
        success: false,
        error: 'Failed to finalize signed PDF snapshot',
      };
    }

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
          const perFieldSignatureDataUrl = signatureDataUrlByFieldInstanceId.get(fieldInstanceId) || finalSignatureDataUrl;
          await db.insert(signatures).values({
            requestId,
            signatureFlowId: flow.id,
            userId,
            fieldInstanceId: fieldInstanceId ?? null,
            pdfHash,
            dataUrl: perFieldSignatureDataUrl ?? undefined,
            userSignatureId: selectedUserSignatureId,
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
        dataUrl: finalSignatureDataUrl ?? undefined,
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
    // With parallel signing: advance to the next stage when all steps at the
    // current order level are resolved (signed or rejected).
    const siblingsAtSameOrder = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.stepOrder, activeStepOrder),
      ));

    const allResolvedAtCurrentOrder = siblingsAtSameOrder.every(
      s => s.status === 'signed' || s.status === 'rejected',
    );

    if (!allResolvedAtCurrentOrder) {
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

      // Notify all newly-activated signers in the next group.
      // NOTE: this must run for every stage transition, including 1 -> 2.
      const nextSigners = await db.select({
        assignedUserId: signatureFlow.assignedUserId,
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
        ));

      const notifyTasks: Array<Promise<void>> = nextSigners.map(ns =>
        signNotificationService.notifySigner({
          signerEmail: ns.signerEmail,
          signerName: ns.signerName,
          stepOrder: ns.stepOrder,
        }, context),
      );

      // Keep requester signed-update behavior unchanged for later stages only.
      if (activeStepOrder > 1) {
        const [currentSigner] = await db.select({
          signerName: sql<string>`
            concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
          `,
        }).from(users).where(eq(users.id, userId));

        if (currentSigner) {
          notifyTasks.unshift(
            signNotificationService.notifySigned({ signerName: currentSigner.signerName, stepOrder: activeStepOrder }, context),
          );
        }
      }

      if (notifyTasks.length > 0) {
        await Promise.all(notifyTasks);
      }

      const nitroApp = useNitroApp() as any;
      const nextSignerNotificationRows = nextSigners
        .filter(step => String(step.assignedUserId ?? '').length > 0)
        .map(step => ({
          userId: String(step.assignedUserId),
          message: 'You have a new request to sign.',
          type: 'sign_request' as const,
          link: `/signer/sign/${requestId}`,
          isRead: false,
        }));

      if (nextSignerNotificationRows.length > 0) {
        const createdNotifications = await db
          .insert(notifications)
          .values(nextSignerNotificationRows)
          .returning();

        for (const notification of createdNotifications) {
          try {
            nitroApp.io.to(notification.userId).emit('notification', notification);
          }
          catch (socketErr) {
            console.error('[sign notification socket emit error]', socketErr);
          }
        }
      }

      if (activeStepOrder > 1) {
        const [currentSigner] = await db.select({
          signerName: sql<string>`
            concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
          `,
        }).from(users).where(eq(users.id, userId));

        if (currentSigner && context.studentId) {
          const [createdStudentNotification] = await db
            .insert(notifications)
            .values({
              userId: String(context.studentId),
              message: `${currentSigner.signerName} has signed your request.`,
              type: 'signed',
              link: '/student/my-requests',
              isRead: false,
            })
            .returning();

          if (createdStudentNotification) {
            try {
              nitroApp.io.to(createdStudentNotification.userId).emit('notification', createdStudentNotification);
            }
            catch (socketErr) {
              console.error('[sign student notification socket emit error]', socketErr);
            }
          }
        }
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

      if (context.studentId) {
        const nitroApp = useNitroApp() as any;
        const [createdNotification] = await db
          .insert(notifications)
          .values({
            userId: String(context.studentId),
            message: 'Your request has been completed.',
            type: 'completed',
            link: '/student/my-requests',
            isRead: false,
          })
          .returning();

        if (createdNotification) {
          try {
            nitroApp.io.to(createdNotification.userId).emit('notification', createdNotification);
          }
          catch (socketErr) {
            console.error('[complete notification socket emit error]', socketErr);
          }
        }
      }

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
