import { supabaseAdmin } from '~~/lib/supabase/client';
import { signNotificationService } from '~~/server/services/sign-notification.service';
import { buildFilledPdfBytesForRequest } from '~~/server/utils/build-filled-pdf-for-request';
import { getSignRequestContext } from '~~/server/utils/get-sign-request-context';
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';

import db from '../../../../lib/db';
import { auditLogs, notifications, request, requestTemplate, requestTemplateValues, signatureFlow, signatures, userRoles, users, userSignatures } from '../../../../lib/db/schema';

type RejectMode = 'status_only' | 'with_signature_and_field';

function normalizeSignatureDataUrl(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) {
    return '';
  }

  const isDataUrl = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/.test(value);
  if (isDataUrl) {
    return value;
  }

  const looksLikeBase64 = /^[A-Z0-9+/=\s]+$/i.test(value) && value.length >= 64;
  if (looksLikeBase64) {
    return `data:image/png;base64,${value.replace(/\s+/g, '')}`;
  }

  return '';
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseNullableInteger(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCheckboxValue(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'checked', 'on'].includes(normalized) ? 'true' : '';
}

function getFieldType(field: any): string {
  return String(field?.type ?? field?.fieldType ?? '').trim().toLowerCase();
}

function isCheckboxField(field: any): boolean {
  const fieldType = getFieldType(field);
  const fieldName = String(field?.name ?? '').trim().toLowerCase();
  return fieldType === 'checkbox' || fieldName === 'check mark';
}

function getTemplatePreferredFieldValue(field: any): string {
  const candidates = [
    field?.preferredValue,
    field?.preferred_value,
    field?.defaultValue,
    field?.default_value,
    field?.value,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value.length > 0) {
      return value;
    }
  }

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
    const reason = (body?.reason as string | undefined)?.trim() ?? '';
    const rawRejectMode = String(body?.rejectMode ?? body?.mode ?? 'status_only').trim();
    const rejectMode: RejectMode = rawRejectMode === 'with_signature_and_field' ? 'with_signature_and_field' : 'status_only';
    const selectedFieldPayload = body?.selectedField as { fieldId?: unknown; instanceId?: unknown; value?: unknown } | undefined;
    const incomingFieldValues = Array.isArray(body?.fieldValues) ? body.fieldValues : [];
    const selectedFieldId = parsePositiveInteger(selectedFieldPayload?.fieldId);
    const selectedFieldInstanceId = String(selectedFieldPayload?.instanceId ?? '').trim();
    const selectedFieldIncomingValue = String(selectedFieldPayload?.value ?? '');
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware
    const nowIso = new Date().toISOString();

    let finalSignatureDataUrl = '';
    let selectedUserSignatureId: number | null = null;

    if (!reason) {
      return { success: false, error: 'กรุณาระบุเหตุผลในการปฏิเสธ' };
    }

    if (reason.length > 1000) {
      return { success: false, error: 'เหตุผลต้องไม่เกิน 1,000 ตัวอักษร' };
    }

    if (rejectMode === 'with_signature_and_field') {
      finalSignatureDataUrl = normalizeSignatureDataUrl(body?.signatureDataUrl);
      if (Number.isFinite(Number(body?.userSignatureId)) && Number(body?.userSignatureId) > 0) {
        const wantedId = Number(body.userSignatureId);
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
          return { success: false, error: 'ไม่พบลายเซ็นที่บันทึกไว้ของผู้ใช้ปัจจุบัน' };
        }

        finalSignatureDataUrl = normalizeSignatureDataUrl(savedSignature.dataUrl);
        selectedUserSignatureId = savedSignature.id;
      }

      if (!finalSignatureDataUrl) {
        return { success: false, error: 'ต้องระบุลายเซ็นสำหรับโหมดปฏิเสธพร้อมข้อมูล' };
      }

      if (finalSignatureDataUrl.length > 1_048_576) {
        return { success: false, error: 'รูปภาพลายเซ็นมีขนาดใหญ่เกินไป (สูงสุด 1 MB)' };
      }
    }

    // Get user's role IDs
    const userRoleRows = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    const userRoleIds = userRoleRows.map(r => r.roleId);

    // Find current pending flow entry
    const pendingFlows = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.status, 'pending'),
      ))
      .orderBy(asc(signatureFlow.stepOrder));

    const flowEntry = pendingFlows.find(flow =>
      flow.assignedUserId === userId
      || (flow.assignedUserId === null && userRoleIds.includes(flow.roleId)),
    );

    if (!flowEntry) {
      return { success: false, error: 'ไม่พบขั้นตอนที่รอดำเนินการสำหรับคำร้องนี้' };
    }

    if (flowEntry.acknowledgeOnly) {
      return { success: false, error: 'ขั้นตอนนี้เป็นแบบรับทราบเท่านั้น ไม่สามารถปฏิเสธได้' };
    }

    // Authorization: same dual-pattern as sign.post.ts
    const isAuthorized
      = flowEntry.assignedUserId === userId
        || (flowEntry.assignedUserId === null && userRoleIds.includes(flowEntry.roleId));

    if (!isAuthorized) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ปฏิเสธในขั้นตอนนี้' };
    }

    const [requestData] = await db
      .select({ status: request.status, templateId: request.templateId })
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (!requestData) {
      return { success: false, error: 'ไม่พบคำร้องนี้' };
    }

    if (requestData.status === 'rejected' || requestData.status === 'completed') {
      return { success: false, error: 'คำร้องนี้ดำเนินการเสร็จสิ้นแล้ว ไม่สามารถปฏิเสธได้' };
    }

    const [templateRuleData] = await db
      .select({ signingFlowData: requestTemplate.signingFlowData })
      .from(requestTemplate)
      .where(eq(requestTemplate.id, Number(requestData.templateId)))
      .limit(1);

    const templateSigningFlowData = Array.isArray(templateRuleData?.signingFlowData)
      ? templateRuleData.signingFlowData as Array<{ id?: unknown; rejectsRequestImmediately?: unknown }>
      : [];

    const currentStepRule = templateSigningFlowData.find((step) => {
      return String(step?.id ?? '').trim() === String(flowEntry.stepId ?? '').trim();
    });

    const shouldRejectWholeRequestImmediately = Boolean(currentStepRule?.rejectsRequestImmediately);

    const activeStepOrder = flowEntry.stepOrder;
    const stageEntries = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.stepOrder, activeStepOrder),
      ));

    const isParallelStage = stageEntries.length > 1;

    const flowEntriesForUserAtActiveStep = stageEntries.filter((flow) => {
      return flow.assignedUserId === userId
        || (flow.assignedUserId === null && userRoleIds.includes(flow.roleId));
    });

    if (rejectMode === 'with_signature_and_field') {
      const [templateData] = await db
        .select({
          placedFieldsData: requestTemplate.placedFieldsData,
        })
        .from(requestTemplate)
        .where(eq(requestTemplate.id, Number(requestData.templateId)))
        .limit(1);

      const placedFields = Array.isArray(templateData?.placedFieldsData)
        ? templateData.placedFieldsData as any[]
        : [];

      const allowedAssignedIds = new Set(
        flowEntriesForUserAtActiveStep.flatMap((flow) => {
          const ids = (flow.assignedFieldInstanceIds as string[]) ?? [];
          return ids.map(id => String(id ?? '').trim()).filter(id => id.length > 0);
        }),
      );
      const hasSelectedField = Boolean(selectedFieldId && selectedFieldInstanceId.length > 0);

      let signatureFieldInstanceId = '';
      const signatureField = placedFields.find((field: any) => {
        return getFieldType(field) === 'signature'
          && allowedAssignedIds.has(String(field?.instanceId ?? '').trim());
      });
      signatureFieldInstanceId = String(signatureField?.instanceId ?? '').trim();

      const normalizedIncomingFieldValues = incomingFieldValues
        .map((entry: any) => ({
          fieldId: parsePositiveInteger(entry?.fieldId),
          instanceId: String(entry?.instanceId ?? '').trim(),
          value: String(entry?.value ?? ''),
        }))
        .filter((entry: { fieldId: number | null; instanceId: string; value: string }) => entry.fieldId && entry.instanceId.length > 0 && allowedAssignedIds.has(entry.instanceId));

      if (normalizedIncomingFieldValues.length === 0 && hasSelectedField) {
        normalizedIncomingFieldValues.push({
          fieldId: selectedFieldId!,
          instanceId: selectedFieldInstanceId,
          value: selectedFieldIncomingValue,
        });
      }

      for (const fieldValue of normalizedIncomingFieldValues) {
        const templateField = placedFields.find((field: any) => {
          const fieldId = parsePositiveInteger(field?.id);
          const fieldInstanceId = String(field?.instanceId ?? '').trim();
          return fieldId === fieldValue.fieldId && fieldInstanceId === fieldValue.instanceId;
        });

        if (!templateField) {
          continue;
        }

        let valueToPersist = fieldValue.value;
        if (!String(valueToPersist).trim().length) {
          valueToPersist = getTemplatePreferredFieldValue(templateField);
        }

        if (isCheckboxField(templateField)) {
          valueToPersist = normalizeCheckboxValue(valueToPersist);
        }

        const maxLength = parsePositiveInteger(templateField?.maxLength ?? templateField?.max_length);
        if (maxLength && valueToPersist.length > maxLength) {
          valueToPersist = valueToPersist.slice(0, maxLength);
        }

        const existingFieldValue = await db
          .select({ id: requestTemplateValues.id })
          .from(requestTemplateValues)
          .where(and(
            eq(requestTemplateValues.requestId, requestId),
            eq(requestTemplateValues.fieldId, fieldValue.fieldId!),
            eq(requestTemplateValues.fieldInstanceId, fieldValue.instanceId),
          ))
          .limit(1);

        if (existingFieldValue[0]) {
          await db
            .update(requestTemplateValues)
            .set({
              value: valueToPersist,
              createdAt: nowIso,
            })
            .where(eq(requestTemplateValues.id, existingFieldValue[0].id));
        }
        else {
          await db.insert(requestTemplateValues).values({
            requestId,
            fieldId: fieldValue.fieldId!,
            fieldInstanceId: fieldValue.instanceId,
            value: valueToPersist,
          });
        }
      }

      const assignedIds = Array.from(allowedAssignedIds);
      const nonSigAssignedIds = assignedIds.filter((id) => {
        const field = placedFields.find((candidate: any) => String(candidate?.instanceId ?? '').trim() === id);
        return field && getFieldType(field) !== 'signature';
      });
      const signatureFields = placedFields.filter((field: any) => {
        return assignedIds.includes(String(field?.instanceId ?? '').trim()) && getFieldType(field) === 'signature';
      });

      let _signedPdfUrl: string | null = null;
      let pdfHash = '';

      const maxMergeAttempts = 3;
      for (let attempt = 1; attempt <= maxMergeAttempts; attempt++) {
        const [requestSnapshot] = await db
          .select({ filledDocumentUrl: request.filledDocumentUrl })
          .from(request)
          .where(eq(request.id, requestId))
          .limit(1);

        if (!requestSnapshot) {
          return { success: false, error: 'Request not found' };
        }

        const baseFilledDocumentUrl = requestSnapshot.filledDocumentUrl ?? null;
        const basePdfUrl = baseFilledDocumentUrl ?? undefined;

        const built = await buildFilledPdfBytesForRequest(requestId, userId, {
          fieldInstanceIdFilter: nonSigAssignedIds,
          basePdfUrl: basePdfUrl ?? undefined,
        });

        if (!built.success) {
          return { success: false, error: built.error === 'Forbidden' ? 'Not allowed to regenerate PDF' : built.error };
        }

        const PDFLib = await import('pdf-lib');
        const pdfDoc = await PDFLib.PDFDocument.load(built.bytes);
        const pages = pdfDoc.getPages();
        const signatureImageCache = new Map<string, any>();

        const [templateRecord] = await db
          .select({ documentWidth: requestTemplate.documentWidth, documentHeight: requestTemplate.documentHeight })
          .from(requestTemplate)
          .where(eq(requestTemplate.id, Number(requestData.templateId)))
          .limit(1);

        const templateWidth = Number(templateRecord?.documentWidth ?? 595);
        const templateHeight = Number(templateRecord?.documentHeight ?? 842);

        for (const field of signatureFields) {
          const pageIndex = (field.pageNumber || 1) - 1;
          const targetPage = pages[pageIndex];
          if (!targetPage) {
            continue;
          }

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

          let sigImage = signatureImageCache.get(finalSignatureDataUrl);
          if (!sigImage) {
            const base64Data = finalSignatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
            const sigBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            sigImage = await pdfDoc.embedPng(sigBytes);
            signatureImageCache.set(finalSignatureDataUrl, sigImage);
          }

          targetPage.drawImage(sigImage, {
            x,
            y: pageHeight - y - height,
            width,
            height,
            opacity: 1,
          });
        }

        const signedPdfBytes = await pdfDoc.save();
        pdfHash = createHash('sha256').update(new Uint8Array(signedPdfBytes)).digest('hex');

        const pdfFilename = `request-${requestId}-reject-${activeStepOrder}-${Date.now()}.pdf`;
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
          _signedPdfUrl = candidateSignedPdfUrl;
          break;
        }

        if (attempt === maxMergeAttempts) {
          return { success: false, error: 'Another signer updated this request at the same time. Please reject again.' };
        }
      }

      const signatureFieldInstanceIds = signatureFields
        .map((field: any) => String(field?.instanceId ?? '').trim())
        .filter((id: string) => id.length > 0);

      for (const flow of flowEntriesForUserAtActiveStep) {
        if (signatureFieldInstanceIds.length > 0) {
          for (const fieldInstanceId of signatureFieldInstanceIds) {
            await db.insert(signatures).values({
              requestId,
              signatureFlowId: flow.id,
              userId,
              fieldInstanceId,
              dataUrl: finalSignatureDataUrl,
              userSignatureId: selectedUserSignatureId,
              pdfHash,
            });
          }
        }
        else {
          signatureFieldInstanceId = hasSelectedField
            ? selectedFieldInstanceId
            : (assignedIds[0] ?? '');

          await db.insert(signatures).values({
            requestId,
            signatureFlowId: flow.id,
            userId,
            fieldInstanceId: signatureFieldInstanceId || null,
            dataUrl: finalSignatureDataUrl,
            userSignatureId: selectedUserSignatureId,
            pdfHash,
          });
        }
      }
    }

    // Full-request rejection behavior:
    // - non-parallel stages (existing behavior)
    // - parallel stages configured to reject immediately for this role/step
    if (!isParallelStage || shouldRejectWholeRequestImmediately) {
      await db
        .update(signatureFlow)
        .set({ status: 'rejected', signedBy: userId, signedAt: nowIso })
        .where(eq(signatureFlow.id, flowEntry.id));

      await db
        .update(signatureFlow)
        .set({ status: 'cancelled' })
        .where(and(
          eq(signatureFlow.requestId, requestId),
          ne(signatureFlow.id, flowEntry.id),
          inArray(signatureFlow.status, ['pending', 'waiting']),
        ));

      await db
        .update(request)
        .set({ status: 'rejected', note: reason })
        .where(eq(request.id, requestId));

      await db.insert(auditLogs).values({
        requestId,
        performedBy: parseNullableInteger(userId),
        action: JSON.stringify({
          type: 'signature_flow_rejected',
          signatureFlowId: flowEntry.id,
          stepOrder: activeStepOrder,
          rejectionMode: 'full_request',
          rejectDataMode: rejectMode,
          reason,
          at: nowIso,
        }),
      });

      const [context, [signer], [template]] = await Promise.all([
        getSignRequestContext(requestId),

        db.select({
          signerName: sql<string>`
      concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
    `,
        })
          .from(users)
          .where(eq(users.id, userId)),

        db.select({ templateId: request.templateId })
          .from(request)
          .where(eq(request.id, requestId)),
      ]);
      await signNotificationService.notifyRejected({ signerName: signer.signerName }, { ...context, templateId: template.templateId }, reason);

      if (context.studentId) {
        const nitroApp = useNitroApp() as any;
        const [createdNotification] = await db
          .insert(notifications)
          .values({
            userId: String(context.studentId),
            messageEng: `Your request was rejected by ${signer.signerName}.`,
            messageTh: `คำร้องของคุณถูกปฏิเสธโดย ${signer.signerName}.`,
            type: 'rejected',
            link: '/student/my-requests',
            isRead: false,
          })
          .returning();

        if (createdNotification) {
          try {
            nitroApp.io.to(createdNotification.userId).emit('notification', createdNotification);
          }
          catch (socketErr) {
            console.error('[reject notification socket emit error]', socketErr);
          }
        }
      }

      return {
        success: true,
        data: {
          status: 'rejected',
          rejectedBy: flowEntry.roleName,
          reason,
          rejectionMode: 'full_request',
          rejectDataMode: rejectMode,
        },
      };
    }

    // Parallel stage: reject only current signer's part.
    await db
      .update(signatureFlow)
      .set({ status: 'rejected', signedBy: userId, signedAt: nowIso })
      .where(eq(signatureFlow.id, flowEntry.id));

    await db.insert(auditLogs).values({
      requestId,
      performedBy: parseNullableInteger(userId),
      action: JSON.stringify({
        type: 'signature_flow_rejected',
        signatureFlowId: flowEntry.id,
        stepOrder: activeStepOrder,
        rejectionMode: 'local_step',
        rejectDataMode: rejectMode,
        reason,
        at: nowIso,
      }),
    });

    const updatedStageEntries = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.stepOrder, activeStepOrder),
      ));

    const stageResolved = updatedStageEntries.every(step => step.status === 'signed' || step.status === 'rejected');

    if (!stageResolved) {
      return {
        success: true,
        data: {
          status: requestData.status ?? 'in_progress',
          rejectedBy: flowEntry.roleName,
          reason,
          rejectionMode: 'local_step',
          rejectDataMode: rejectMode,
          nextRole: null,
        },
      };
    }

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

      const [context, nextSigners] = await Promise.all([
        getSignRequestContext(requestId),
        db.select({
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
          )),
      ]);

      if (nextSigners.length > 0) {
        await Promise.all(
          nextSigners.map(step => signNotificationService.notifySigner({
            signerEmail: step.signerEmail,
            signerName: step.signerName,
            stepOrder: step.stepOrder,
          }, context)),
        );

        const nitroApp = useNitroApp() as any;
        const nextSignerNotifications = nextSigners
          .filter(step => String(step.assignedUserId ?? '').length > 0)
          .map(step => ({
            userId: String(step.assignedUserId),
            messageEng: 'You have a new request to sign.',
            messageTh: 'คุณมีคำร้องใหม่ให้ลงนาม',
            type: 'sign_request' as const,
            link: `/signer/sign/${requestId}`,
            isRead: false,
          }));

        if (nextSignerNotifications.length > 0) {
          const createdNotifications = await db
            .insert(notifications)
            .values(nextSignerNotifications)
            .returning();

          for (const notification of createdNotifications) {
            try {
              nitroApp.io.to(notification.userId).emit('notification', notification);
            }
            catch (socketErr) {
              console.error('[reject next-signer notification socket emit error]', socketErr);
            }
          }
        }
      }

      return {
        success: true,
        data: {
          status: 'in_progress',
          rejectedBy: flowEntry.roleName,
          reason,
          rejectionMode: 'local_step',
          rejectDataMode: rejectMode,
          nextRole: nextWaiting[0].roleName,
        },
      };
    }

    await db
      .update(request)
      .set({ status: 'completed', completedAt: new Date().toISOString() })
      .where(eq(request.id, requestId));

    return {
      success: true,
      data: {
        status: 'completed',
        rejectedBy: flowEntry.roleName,
        reason,
        rejectionMode: 'local_step',
        rejectDataMode: rejectMode,
        nextRole: null,
      },
    };
  }
  catch (error: any) {
    console.error('Error rejecting request:', error);
    return { success: false, error: error.message || 'เกิดข้อผิดพลาดในการปฏิเสธคำร้อง' };
  }
});
