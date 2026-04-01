import { signNotificationService } from '~~/server/services/sign-notification.service';
import { getSignRequestContext } from '~~/server/utils/get-sign-request-context';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import db from '../../../../lib/db';
import { request, requestTemplate, roles, signatureFlow, userRoles, users } from '../../../../lib/db/schema';

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
    // recipients: Array<{ stepId: string; userId: string }>
    const recipientMap = new Map<string, string>(
      (body?.recipients ?? []).map((r: { stepId: string; userId: string }) => [r.stepId, r.userId]),
    );

    const signingSteps = (template.signingFlowData as any[]) || [];
    const placedFields = (template.placedFieldsData as any[]) || [];

    // Signature fields require explicit signing; submission alone must not auto-sign them.
    const signatureFieldInstanceIdSet = new Set(
      placedFields
        .filter((field: any) => String(field?.type ?? '').trim().toLowerCase() === 'signature')
        .map((field: any) => String(field?.instanceId ?? '').trim())
        .filter((instanceId: string) => instanceId.length > 0),
    );

    // Create signature_flow entries sorted by order
    const sorted = [...signingSteps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

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
      // in that case, skip notifications and directly mark the request as submitted
      if (insertedFlowEntries.length > 1) {
      // Notify the first signer (teacher)
        const [context, [firstStep]] = await Promise.all([
          getSignRequestContext(requestId),
          db
            .select({
              signerEmail: users.email,
              signerName: sql<string>`
            concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
          `,
              stepOrder: signatureFlow.stepOrder,
            })
            .from(signatureFlow)
            .innerJoin(users, eq(signatureFlow.assignedUserId, users.id))
            .where(and(

              // The first position ([0]) is a student who is the first signer, so index [1] (next signer -> teacher) must be used
              // instead of [0]
              eq(signatureFlow.id, insertedFlowEntries[1].id),

              eq(signatureFlow.requestId, requestId),
            ))
            .orderBy(asc(signatureFlow.stepOrder))
            .limit(1),
        ]);
        if (firstStep) {
          await signNotificationService.notifySigner(firstStep, context);
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
