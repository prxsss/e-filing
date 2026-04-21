import { signNotificationService } from '~~/server/services/sign-notification.service';
import { getSignRequestContext } from '~~/server/utils/get-sign-request-context';
import { and, asc, eq, sql } from 'drizzle-orm';

import db from '../../../../lib/db';
import { notifications, request, requestTemplate, requestTemplateValues, signatureFlow, signatures, userRoles, users, userSignatures } from '../../../../lib/db/schema';

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

      if (!selectedFieldId || !selectedFieldInstanceId.length) {
        return { success: false, error: 'ต้องเลือกฟิลด์ 1 รายการสำหรับโหมดปฏิเสธพร้อมข้อมูล' };
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

      const templateField = placedFields.find((field: any) => {
        const fieldId = parsePositiveInteger(field?.id);
        const fieldInstanceId = String(field?.instanceId ?? '').trim();
        return fieldId === selectedFieldId && fieldInstanceId === selectedFieldInstanceId;
      });

      if (!templateField) {
        return { success: false, error: 'ไม่พบฟิลด์ที่เลือกในเทมเพลต' };
      }

      const allowedAssignedIds = new Set(
        flowEntriesForUserAtActiveStep.flatMap((flow) => {
          const ids = (flow.assignedFieldInstanceIds as string[]) ?? [];
          return ids.map(id => String(id ?? '').trim()).filter(id => id.length > 0);
        }),
      );

      if (!allowedAssignedIds.has(selectedFieldInstanceId)) {
        return { success: false, error: 'ฟิลด์ที่เลือกไม่อยู่ในรายการที่ผู้ลงนามปัจจุบันมีสิทธิ์แก้ไข' };
      }

      let valueToPersist = selectedFieldIncomingValue;
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
          eq(requestTemplateValues.fieldId, selectedFieldId!),
          eq(requestTemplateValues.fieldInstanceId, selectedFieldInstanceId),
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
          fieldId: selectedFieldId!,
          fieldInstanceId: selectedFieldInstanceId,
          value: valueToPersist,
        });
      }

      for (const flow of flowEntriesForUserAtActiveStep) {
        await db.insert(signatures).values({
          requestId,
          signatureFlowId: flow.id,
          userId,
          fieldInstanceId: selectedFieldInstanceId,
          dataUrl: finalSignatureDataUrl,
          userSignatureId: selectedUserSignatureId,
        });
      }
    }

    // Non-parallel stage: preserve existing full-request rejection behavior.
    if (!isParallelStage) {
      await db
        .update(signatureFlow)
        .set({ status: 'rejected', signedBy: userId, signedAt: nowIso })
        .where(eq(signatureFlow.id, flowEntry.id));

      await db
        .update(signatureFlow)
        .set({ status: 'cancelled' })
        .where(and(
          eq(signatureFlow.requestId, requestId),
          eq(signatureFlow.status, 'waiting'),
        ));

      await db
        .update(request)
        .set({ status: 'rejected', note: reason })
        .where(eq(request.id, requestId));

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
            message: `Your request was rejected by ${signer.signerName}.`,
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
            message: 'You have a new request to sign.',
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
