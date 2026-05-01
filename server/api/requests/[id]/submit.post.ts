import { signNotificationService } from '~~/server/services/sign-notification.service';
import { getSignRequestContext } from '~~/server/utils/get-sign-request-context';
import { trimTemplateTitle } from '~~/server/utils/trim-template-title';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import db from '../../../../lib/db';
import { notifications, request, requestTemplate, requestTemplateValues, roles, signatureFlow, userRoles, users } from '../../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return { success: false, error: 'Invalid request ID' };
    }

    // Auth guard — must be logged in
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware
    const submitterId = userId;

    const [requestData] = await db
      .select()
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (!requestData) {
      return { success: false, error: 'Request not found' };
    }

    // Ownership check — only the request owner may submit
    if (requestData.userId !== submitterId) {
      throw createError({ statusCode: 403, message: 'Forbidden: you do not own this request' });
    }

    if (requestData.status !== 'draft') {
      return { success: false, error: 'Request is not in draft status' };
    }

    const [template] = await db
      .select()
      .from(requestTemplate)
      .where(eq(requestTemplate.id, Number(requestData.templateId)))
      .limit(1);

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const body = await readBody(event);
    const rawRecipients = Array.isArray(body?.recipients)
      ? body.recipients as Array<{ stepId?: unknown; userId?: unknown }>
      : [];

    const recipientMap = new Map<string, string>();
    const seenStepIds = new Set<string>();

    for (const recipient of rawRecipients) {
      const stepId = String(recipient?.stepId ?? '').trim();
      const userId = String(recipient?.userId ?? '').trim();

      if (!stepId.length || !userId.length) {
        return { success: false, error: 'Invalid recipient assignment payload' };
      }

      if (seenStepIds.has(stepId)) {
        return { success: false, error: `Duplicate recipient assignment for step ${stepId}` };
      }

      seenStepIds.add(stepId);
      recipientMap.set(stepId, userId);
    }

    const rawActiveStepIds = Array.isArray(body?.activeStepIds)
      ? body.activeStepIds as unknown[]
      : [];
    const requestedActiveStepIds = new Set<string>(
      rawActiveStepIds
        .map(stepId => String(stepId ?? '').trim())
        .filter(stepId => stepId.length > 0),
    );

    const signingSteps = (template.signingFlowData as any[]) || [];
    const placedFields = (template.placedFieldsData as any[]) || [];

    const storedFieldValues = await db
      .select({
        fieldId: requestTemplateValues.fieldId,
        fieldInstanceId: requestTemplateValues.fieldInstanceId,
        value: requestTemplateValues.value,
      })
      .from(requestTemplateValues)
      .where(eq(requestTemplateValues.requestId, requestId));

    const valueByInstanceId = new Map<string, string>();
    const valueByFieldId = new Map<number, string>();
    for (const row of storedFieldValues) {
      const instanceId = String(row.fieldInstanceId ?? '').trim();
      const value = String(row.value ?? '');
      if (instanceId.length > 0) {
        valueByInstanceId.set(instanceId, value);
      }

      const fieldId = Number.parseInt(String(row.fieldId ?? ''), 10);
      if (Number.isFinite(fieldId) && !valueByFieldId.has(fieldId)) {
        valueByFieldId.set(fieldId, value);
      }
    }

    const getStoredTemplateFieldValue = (field: any): string => {
      const instanceId = String(field?.instanceId ?? '').trim();
      if (instanceId.length > 0 && valueByInstanceId.has(instanceId)) {
        return String(valueByInstanceId.get(instanceId) ?? '');
      }

      const fieldId = Number.parseInt(String(field?.id ?? ''), 10);
      if (Number.isFinite(fieldId) && valueByFieldId.has(fieldId)) {
        return String(valueByFieldId.get(fieldId) ?? '');
      }

      return '';
    };

    const getTemplateFieldType = (field: any): string =>
      String(field?.type ?? field?.fieldType ?? '').trim().toLowerCase();

    const buildSignRequestMessages = (context: {
      documentTitle?: string | null;
      studentName?: string | null;
      studentNameTh?: string | null;
      studentNameEn?: string | null;
      department?: string | null;
      departmentTh?: string | null;
      departmentEn?: string | null;
    }) => {
      const documentTitle = trimTemplateTitle(context.documentTitle);
      const titleTh = documentTitle || 'คำร้อง';
      const titleEng = documentTitle || 'request';

      const studentNameTh = String(context.studentNameTh ?? context.studentName ?? '').trim();
      const departmentTh = String(context.departmentTh ?? context.department ?? '').trim();
      const studentNameEn = String(context.studentNameEn ?? '').trim() || studentNameTh;
      const departmentEn = String(context.departmentEn ?? '').trim() || departmentTh;

      const identityTh = [studentNameTh, departmentTh].filter(Boolean).join(' สาขา');
      const identityEng = [studentNameEn, departmentEn].filter(Boolean).join(' ');

      return {
        messageEng: identityEng
          ? `You have ${titleEng} from ${identityEng} to sign`
          : `You have ${titleEng} to sign`,
        messageTh: identityTh
          ? `คุณมี ${titleTh} จาก ${identityTh} ที่ต้องเซ็น`
          : `คุณมี ${titleTh} ที่ต้องเซ็น`,
      };
    };

    const isTemplateCheckboxField = (field: any): boolean => {
      const fieldType = getTemplateFieldType(field);
      const fieldName = String(field?.name ?? '').trim().toLowerCase();
      return fieldType === 'checkbox' || fieldName === 'check mark';
    };

    const normalizeCheckboxValue = (value: unknown): string => {
      const normalized = String(value ?? '').trim().toLowerCase();
      return ['true', '1', 'yes', 'y', 'checked', 'on'].includes(normalized) ? 'true' : '';
    };

    const getTemplateVisibilityRule = (field: any) => {
      const rawRule = field?.visibilityRule ?? field?.visibility_rule;
      if (!rawRule || typeof rawRule !== 'object') {
        return null;
      }

      const sourceFieldInstanceId = String(rawRule.sourceFieldInstanceId ?? rawRule.source_field_instance_id ?? '').trim();
      const sourceGroupId = String(rawRule.sourceGroupId ?? rawRule.source_group_id ?? '').trim();
      if (!sourceFieldInstanceId.length && !sourceGroupId.length) {
        return null;
      }

      return {
        enabled: rawRule.enabled !== false,
        sourceFieldInstanceId: sourceFieldInstanceId || null,
        sourceGroupId: sourceGroupId || null,
        operator: rawRule.operator === 'isUnchecked' ? 'isUnchecked' as const : 'isChecked' as const,
      };
    };

    const isTemplateFieldVisible = (field: any): boolean => {
      const rule = getTemplateVisibilityRule(field);
      if (!rule || rule.enabled === false) {
        return true;
      }

      let isChecked = false;
      if (rule.sourceGroupId) {
        const groupCheckboxes = placedFields.filter((candidate: any) => {
          return isTemplateCheckboxField(candidate) && String(candidate?.groupId ?? '').trim() === rule.sourceGroupId;
        });

        isChecked = groupCheckboxes.some((candidate: any) =>
          normalizeCheckboxValue(getStoredTemplateFieldValue(candidate)) === 'true',
        );
      }
      else {
        const sourceField = placedFields.find(
          (candidate: any) => String(candidate?.instanceId ?? '').trim() === String(rule.sourceFieldInstanceId ?? ''),
        );

        if (!sourceField) {
          return true;
        }

        isChecked = normalizeCheckboxValue(getStoredTemplateFieldValue(sourceField)) === 'true';
      }

      return rule.operator === 'isUnchecked' ? !isChecked : isChecked;
    };

    const activeStepIdsFromTemplate = new Set<string>();
    for (const field of placedFields) {
      const signerStepId = String(field?.signerStepId ?? field?.signer_step_id ?? '').trim();
      if (!signerStepId.length) {
        continue;
      }

      const fieldType = getTemplateFieldType(field);
      const contributesToSignerStep = fieldType === 'signature'
        || (field.isFillable !== false && field.is_fillable !== false);

      if (!contributesToSignerStep || !isTemplateFieldVisible(field)) {
        continue;
      }

      activeStepIdsFromTemplate.add(signerStepId);
    }

    const effectiveActiveStepIds = requestedActiveStepIds.size > 0
      ? requestedActiveStepIds
      : activeStepIdsFromTemplate;

    for (const stepId of requestedActiveStepIds) {
      if (!activeStepIdsFromTemplate.has(stepId)) {
        return { success: false, error: `Step ${stepId} is not active for current request values` };
      }
    }

    for (const stepId of recipientMap.keys()) {
      if (!effectiveActiveStepIds.has(stepId)) {
        return { success: false, error: `Recipient assignment for inactive step ${stepId} is not allowed` };
      }
    }

    // Signature fields require explicit signing; submission alone must not auto-sign them.
    const signatureFieldInstanceIdSet = new Set(
      placedFields
        .filter((field: any) => String(field?.type ?? '').trim().toLowerCase() === 'signature')
        .map((field: any) => String(field?.instanceId ?? '').trim())
        .filter((instanceId: string) => instanceId.length > 0),
    );

    // Create signature_flow entries sorted by order
    const sorted = signingSteps
      .filter((step: any) => effectiveActiveStepIds.has(String(step?.id ?? '').trim()))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (sorted.length > 0) {
      // Fetch the submitter's DB role IDs for self-assignment logic (see below)
      const submitterRoleRows = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, submitterId));
      const submitterRoleSet = new Set(submitterRoleRows.map(r => r.roleId));

      // Resolve roleIds: prefer stored roleId, fallback to lookup by roleName
      const needsLookup = sorted.filter(s => !s.roleId || Number.isNaN(Number(s.roleId)));
      const roleNameMap = new Map<string, number>();
      if (needsLookup.length > 0) {
        const roleNames = [...new Set(needsLookup.map((s: any) => s.roleName))];
        const foundRoles = await db
          .select({ id: roles.id, name: roles.name })
          .from(roles)
          .where(inArray(roles.name, roleNames));
        foundRoles.forEach(r => roleNameMap.set(r.name, r.id));
      }

      // ── Pass 1: resolve every step's assignedUserId and auto-sign flag ──────
      // "auto-signed" = the submitter is the intended signer for this step (their
      // role matches AND they end up directly assigned to it) AND the step has no
      // signature fields. Steps that include signature fields must be explicitly
      // signed in the signing page to preserve actual signature intent.
      type Draft = {
        requestId: number;
        stepId: string;
        stepOrder: number;
        roleId: number;
        roleName: string;
        assignedFieldInstanceIds: string[];
        assignedUserId: string | null;
        requiresSignature: boolean;
        autoSigned: boolean;
      };

      const draftEntries: Draft[] = sorted.map((step: any, index: number) => {
        const resolvedRoleId = (step.roleId && !Number.isNaN(Number(step.roleId)))
          ? Number(step.roleId)
          : (roleNameMap.get(step.roleName) ?? null);

        if (!resolvedRoleId) {
          throw createError({
            statusCode: 422,
            message: `Cannot resolve role for signing step "${step.roleName}". Ensure the role exists.`,
          });
        }

        // Priority chain for assignedUserId:
        //   1. Template pre-assignment (baked in by the template creator)
        //   2. UI-selected recipient (submitter picked a specific person)
        //   3. Self-assignment (submitter's role matches this step → their own step)
        //   4. null → role-based queue (any user with matching role)
        const templatePreAssigned: string | null = (step.assignedUserId as string | undefined) || null;
        const uiSelected: string | null = recipientMap.get(step.id) || null;
        const isSubmitterStep = submitterRoleSet.has(resolvedRoleId);
        const selfAssigned: string | null = isSubmitterStep ? submitterId : null;
        const resolvedAssignedUserId: string | null = templatePreAssigned ?? uiSelected ?? selfAssigned;

        const assignedFieldInstanceIds = Array.isArray(step.assignedFieldInstanceIds)
          ? step.assignedFieldInstanceIds
              .map((instanceId: unknown) => String(instanceId ?? '').trim())
              .filter((instanceId: string) => instanceId.length > 0)
          : [];

        const requiresSignature = assignedFieldInstanceIds
          .some((instanceId: string) => signatureFieldInstanceIdSet.has(instanceId));

        // Auto-sign when the submitter IS the signer (role match + direct assignment)
        // EXCEPT when this step has signature fields, which require explicit ink/sign action.
        const autoSigned = isSubmitterStep
          && resolvedAssignedUserId === submitterId
          && !requiresSignature;

        return {
          requestId,
          stepId: String(step.id ?? index),
          stepOrder: step.order ?? index + 1,
          roleId: resolvedRoleId,
          roleName: step.roleName,
          assignedFieldInstanceIds,
          assignedUserId: resolvedAssignedUserId,
          requiresSignature,
          autoSigned,
        };
      });

      // ── Pass 2: assign flow status ───────────────────────────────────────
      // auto-signed → 'signed' (submission = acknowledgement)
      // All steps at the first non-auto-signed order group → 'pending'  (parallel signers)
      // rest → 'waiting'
      const now = new Date().toISOString();

      // Find the order number of the first stage that requires real signing action.
      // All steps at this order level become 'pending' simultaneously (parallel).
      const firstPendingOrder = draftEntries
        .filter(e => !e.autoSigned)
        .sort((a, b) => a.stepOrder - b.stepOrder)[0]
        ?.stepOrder ?? null;

      const flowEntries = draftEntries.map(({ autoSigned, requiresSignature: _requiresSignature, ...entry }) => {
        if (autoSigned) {
          return { ...entry, status: 'signed', signedBy: submitterId, signedAt: now };
        }
        if (firstPendingOrder !== null && entry.stepOrder === firstPendingOrder) {
          return {
            ...entry,
            status: 'pending',

            // roleId 1 = student (submitter) → skip pendingAt
            // Documents that require student signatures before submission will cause the student's flow status to be pending
            // and will later be changed to signed at the API sign.post file.
            // Therefore, assigning a value to pendingAt must be skipped in this case.
            pendingAt: entry.roleId === 1 ? null : now,
          };
        }
        return { ...entry, status: 'waiting' };
      });

      const insertedFlowEntries = await db.insert(signatureFlow).values(flowEntries).returning();

      // Some requests may have no signing steps at all —
      // in that case, skip notifications and directly mark the request as submitted.
      // For parallel steps, notify every assignee in the first active pending group.
      if (insertedFlowEntries.length > 0) {
        const [context, pendingAssignees] = await Promise.all([
          getSignRequestContext(requestId),
          db
            .select({
              signerEmail: users.email,
              signerName: sql<string>`
            concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
          `,
              stepOrder: signatureFlow.stepOrder,
              assignedUserId: signatureFlow.assignedUserId,
            })
            .from(signatureFlow)
            .innerJoin(users, eq(signatureFlow.assignedUserId, users.id))
            .where(and(
              eq(signatureFlow.requestId, requestId),
              eq(signatureFlow.status, 'pending'),
            ))
            .orderBy(asc(signatureFlow.stepOrder)),
        ]);

        const nitroApp = useNitroApp() as any;

        const uniquePendingAssignees = Array.from(new Map(
          pendingAssignees
            .filter(step => step.assignedUserId && step.assignedUserId !== submitterId)
            .map(step => [step.assignedUserId, {
              userId: step.assignedUserId,
              signerEmail: step.signerEmail,
              signerName: step.signerName,
              stepOrder: step.stepOrder,
            }]),
        ).values());

        if (uniquePendingAssignees.length > 0) {
          const { messageEng, messageTh } = buildSignRequestMessages(context);
          await Promise.allSettled(
            uniquePendingAssignees.map(step => signNotificationService.notifySigner({
              signerEmail: step.signerEmail,
              signerName: step.signerName,
              stepOrder: step.stepOrder,
            }, context)),
          );

          const createdNotifications = await db
            .insert(notifications)
            .values(uniquePendingAssignees.map(step => ({
              userId: String(step.userId),
              messageEng,
              messageTh,
              type: 'sign_request' as const,
              link: `/signer/sign/${requestId}`,
              isRead: false,
            })))
            .returning();

          for (const notification of createdNotifications) {
            try {
              nitroApp.io.to(notification.userId).emit('notification', notification);
            }
            catch (socketErr) {
              console.error('[submit notification socket emit error]', socketErr);
            }
          }
        }
      }

      // Request status mirrors the flow state:
      //   all auto-signed  → completed (no further signing needed)
      //   some auto-signed → in_progress (first real signer is now pending)
      //   none auto-signed → pending_signature (waiting for first signer)
      const allAutoSigned = draftEntries.every(e => e.autoSigned);
      const anyAutoSigned = draftEntries.some(e => e.autoSigned);
      const newStatus = allAutoSigned
        ? 'completed'
        : anyAutoSigned
          ? 'in_progress'
          : 'pending_signature';

      const requiresSubmitterSignature = draftEntries.some(entry =>
        !entry.autoSigned
        && entry.requiresSignature
        && entry.assignedUserId === submitterId,
      );

      await db
        .update(request)
        .set({ status: newStatus, submittedAt: new Date().toISOString() })
        .where(eq(request.id, requestId));

      return {
        success: true,
        data: {
          status: newStatus,
          requiresSubmitterSignature,
        },
      };
    }

    // No signing steps at all — request is immediately submitted
    await db
      .update(request)
      .set({ status: 'submitted', submittedAt: new Date().toISOString() })
      .where(eq(request.id, requestId));

    return { success: true, data: { status: 'submitted' } };
  }
  catch (error: any) {
    console.error('Error submitting request:', error);
    return { success: false, error: error.message || 'Failed to submit request' };
  }
});
