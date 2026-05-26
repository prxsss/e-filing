import { isActiveDelegateForRequest } from '~~/lib/db/queries/dean-delegation';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import db from '../../../../lib/db';
import { request, requestTemplate, roles, signatureFlow, signatures, userRoles, users } from '../../../../lib/db/schema';

type StoredRejectionReasonPayload = {
  signatureFlowId?: unknown;
  reason?: unknown;
};

function normalizeStoredRejectionReasons(raw: unknown): Array<{ signatureFlowId: number; reason: string }> {
  const entries = Array.isArray(raw)
    ? raw.map((value, index) => [String(index), value] as const)
    : raw && typeof raw === 'object'
      ? Object.entries(raw as Record<string, unknown>)
      : [];

  const normalized: Array<{ signatureFlowId: number; reason: string }> = [];

  for (const [key, value] of entries) {
    if (!value || typeof value !== 'object') {
      continue;
    }

    const payload = value as StoredRejectionReasonPayload;
    const signatureFlowId = Number.parseInt(String(payload.signatureFlowId ?? key), 10);
    const reason = String(payload.reason ?? '').trim();
    if (!Number.isFinite(signatureFlowId) || signatureFlowId <= 0 || reason.length === 0) {
      continue;
    }

    normalized.push({ signatureFlowId, reason });
  }

  return normalized;
}

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return { success: false, error: 'Invalid request ID' };
    }

    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware

    // Get the current user's role IDs to determine if it's their turn to sign
    const userRoleRows = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    const userRoleIds = userRoleRows.map(r => r.roleId);

    const [requestData] = await db
      .select()
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (!requestData) {
      return { success: false, error: 'Request not found' };
    }

    // Pattern C: dean delegation authorization for signing detail page
    // so delegated users can see and act when the pending step is dean.
    let userIsDeanDelegate = false;
    let deanRoleId: number | null = null;
    if (requestData.facultyId && requestData.templateId) {
      const [deanRoleRow, delegateCheck] = await Promise.all([
        db.select({ id: roles.id }).from(roles).where(sql`lower(${roles.name}) = 'dean'`).limit(1),
        isActiveDelegateForRequest(userId, Number(requestData.facultyId), Number(requestData.templateId)),
      ]);
      deanRoleId = deanRoleRow[0]?.id ?? null;
      userIsDeanDelegate = delegateCheck;
    }

    const [template] = await db
      .select({
        name: requestTemplate.name,
        signingFlowData: requestTemplate.signingFlowData,
        placedFieldsData: requestTemplate.placedFieldsData,
        documentWidth: requestTemplate.documentWidth,
        documentHeight: requestTemplate.documentHeight,
      })
      .from(requestTemplate)
      .where(eq(requestTemplate.id, Number(requestData.templateId)))
      .limit(1);

    const flowStepRows = await db
      .select({
        step: signatureFlow,
        roleNameTh: roles.nameTh,
      })
      .from(signatureFlow)
      .leftJoin(roles, eq(signatureFlow.roleId, roles.id))
      .where(eq(signatureFlow.requestId, requestId))
      .orderBy(asc(signatureFlow.stepOrder));

    const flowSteps = flowStepRows.map(({ step, roleNameTh }) => ({
      ...step,
      roleNameTh: roleNameTh ?? '-',
    }));

    const flowUserIds = Array.from(new Set(
      flowSteps.flatMap(step => [step.assignedUserId, step.signedBy])
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    ));

    const userNameById = new Map<string, string>();
    const userNameThById = new Map<string, string | null>();
    if (flowUserIds.length > 0) {
      const flowUsers = await db
        .select({
          id: users.id,
          titleTh: users.titleTh,
          firstNameTh: users.firstNameTh,
          lastNameTh: users.lastNameTh,
          titleEn: users.titleEn,
          firstNameEn: users.firstNameEn,
          lastNameEn: users.lastNameEn,
        })
        .from(users)
        .where(inArray(users.id, flowUserIds));

      for (const flowUser of flowUsers) {
        const fullNameTh = `${flowUser.titleTh ?? ''}${flowUser.firstNameTh ?? ''} ${flowUser.lastNameTh ?? ''}`.trim();
        const fullNameEn = `${flowUser.titleEn ?? ''} ${flowUser.firstNameEn ?? ''} ${flowUser.lastNameEn ?? ''}`.trim();
        userNameById.set(flowUser.id, fullNameEn || flowUser.id);
        userNameThById.set(flowUser.id, fullNameTh || flowUser.id);
      }
    }

    const flowStepsWithNames = flowSteps.map(step => ({
      ...step,
      assignedUserName: step.assignedUserId ? (userNameById.get(step.assignedUserId) ?? null) : null,
      assignedUserNameTh: step.assignedUserId ? (userNameThById.get(step.assignedUserId) ?? null) : null,
      signedByName: step.signedBy ? (userNameById.get(step.signedBy) ?? null) : null,
      signedByNameTh: step.signedBy ? (userNameThById.get(step.signedBy) ?? null) : null,
      rejectedReason: null as string | null,
    }));

    const rejectedReasonByFlowId = new Map<number, string>(
      normalizeStoredRejectionReasons(requestData.rejectionReasons)
        .map(entry => [entry.signatureFlowId, entry.reason] as const),
    );

    for (const step of flowStepsWithNames) {
      if (step.status !== 'rejected') {
        continue;
      }

      step.rejectedReason = rejectedReasonByFlowId.get(step.id) ?? null;
      if (!step.rejectedReason && requestData.status === 'rejected') {
        step.rejectedReason = requestData.note ?? null;
      }
    }

    const requestedFlowIdRaw = Number.parseInt(String(getQuery(event).flowId ?? ''), 10);
    const requestedFlowId = Number.isFinite(requestedFlowIdRaw) && requestedFlowIdRaw > 0
      ? requestedFlowIdRaw
      : null;

    const isAuthorizedForAcknowledgeFlow = (s: typeof flowStepsWithNames[number]) =>
      s.assignedUserId === userId
      || (s.assignedUserId === null && userRoleIds.includes(s.roleId));

    // Determine whether the current user may act on a pending sign step.
    // Mirrors the same routing used in for-signing endpoints:
    //   Pattern A — direct assignment: assignedUserId === me
    //   Pattern B — role queue:        assignedUserId is null AND roleId ∈ userRoles
    //   Pattern C — delegation:        active delegate may sign dean role
    const isAuthorizedForPendingFlow = (s: typeof flowStepsWithNames[number]) =>
      s.assignedUserId === userId
      || (s.assignedUserId === null && userRoleIds.includes(s.roleId))
      || (userIsDeanDelegate && deanRoleId !== null && s.roleId === deanRoleId);

    const requestedFlow = requestedFlowId === null
      ? null
      : (flowStepsWithNames.find(s => s.id === requestedFlowId) ?? null);

    const requestedPendingStep = requestedFlow
      && requestedFlow.status === 'pending'
      && !requestedFlow.acknowledgeOnly
      && isAuthorizedForPendingFlow(requestedFlow)
      ? requestedFlow
      : null;

    const requestedAcknowledgeStep = requestedFlow
      && requestedFlow.acknowledgeOnly
      && (requestedFlow.status === 'pending' || requestedFlow.status === 'waiting')
      && isAuthorizedForAcknowledgeFlow(requestedFlow)
      ? requestedFlow
      : null;

    const pendingStep = requestedAcknowledgeStep
      ? null
      : (requestedPendingStep ?? flowStepsWithNames.find(s =>
          s.status === 'pending'
          && !s.acknowledgeOnly
          && isAuthorizedForPendingFlow(s),
        ) ?? null);

    const activeStageOrder = pendingStep?.stepOrder ?? null;
    const pendingStepsForCurrentUser = activeStageOrder === null
      ? []
      : flowStepsWithNames.filter(step =>
          step.status === 'pending'
          && !step.acknowledgeOnly
          && step.stepOrder === activeStageOrder
          && isAuthorizedForPendingFlow(step),
        );

    const acknowledgeStepsForCurrentUser = requestedAcknowledgeStep
      ? flowStepsWithNames.filter(step =>
          step.acknowledgeOnly
          && (step.status === 'pending' || step.status === 'waiting')
          && step.stepOrder === requestedAcknowledgeStep.stepOrder
          && isAuthorizedForAcknowledgeFlow(step),
        )
      : flowStepsWithNames.filter(step =>
          step.acknowledgeOnly
          && (step.status === 'pending' || step.status === 'waiting')
          && isAuthorizedForAcknowledgeFlow(step),
        );

    // Build signature field positions only for the currently actionable context.
    // This prevents showing signature targets from another step at the same time.
    const allFields = (template?.placedFieldsData as any[]) ?? [];
    const actionableSteps = pendingStepsForCurrentUser.length > 0
      ? pendingStepsForCurrentUser
      : acknowledgeStepsForCurrentUser;
    const assignedIds = Array.from(new Set(
      actionableSteps.flatMap((step) => {
        const ids = (step.assignedFieldInstanceIds as string[]) ?? [];
        return ids.map(id => String(id ?? '').trim()).filter(id => id.length > 0);
      }),
    ));
    const signatureFields = allFields
      .filter((f: any) => {
        const fieldType = String(f?.type ?? f?.fieldType ?? '').trim().toLowerCase();
        return assignedIds.includes(f.instanceId) && fieldType === 'signature';
      })
      .map((f: any) => ({
        instanceId: f.instanceId as string,
        pageNumber: (f.pageNumber ?? 1) as number,
        normalizedX: f.normalizedX as number | undefined,
        normalizedY: f.normalizedY as number | undefined,
        normalizedWidth: f.normalizedWidth as number | undefined,
        normalizedHeight: f.normalizedHeight as number | undefined,
        x: f.x as number | undefined,
        y: f.y as number | undefined,
        width: f.width as number | undefined,
        height: f.height as number | undefined,
      }));

    // Confirmed signature images for the current user (used for preview overlay).
    // This lets the client render signatures separately instead of relying on the PDF
    // already having them embedded.
    const signatureRows = await db
      .select()
      .from(signatures)
      .where(and(
        eq(signatures.requestId, requestId),
        eq(signatures.userId, userId),
      ))
      .orderBy(asc(signatures.createdAt));

    const imageUrlByFieldInstanceId = new Map<string, string>();
    for (const row of signatureRows) {
      const instanceId = row.fieldInstanceId;
      const dataUrl = (row as any).dataUrl as string | null | undefined;
      if (instanceId && dataUrl) {
        imageUrlByFieldInstanceId.set(String(instanceId), dataUrl);
      }
    }

    const confirmedAssignedIds = Array.from(imageUrlByFieldInstanceId.keys());
    const confirmedSignatureFields = allFields
      .filter((f: any) => {
        const fieldType = String(f?.type ?? f?.fieldType ?? '').trim().toLowerCase();
        return confirmedAssignedIds.includes(f.instanceId) && fieldType === 'signature';
      })
      .map((f: any) => ({
        instanceId: f.instanceId as string,
        pageNumber: (f.pageNumber ?? 1) as number,
        normalizedX: f.normalizedX as number | undefined,
        normalizedY: f.normalizedY as number | undefined,
        normalizedWidth: f.normalizedWidth as number | undefined,
        normalizedHeight: f.normalizedHeight as number | undefined,
        x: f.x as number | undefined,
        y: f.y as number | undefined,
        width: f.width as number | undefined,
        height: f.height as number | undefined,
        imageUrl: imageUrlByFieldInstanceId.get(String(f.instanceId)) || null,
      }));

    return {
      success: true,
      data: {
        requestId,
        status: requestData.status,
        filledDocumentUrl: requestData.filledDocumentUrl,
        templateName: template?.name ?? null,
        note: requestData.note ?? null,
        flowSteps: flowStepsWithNames,
        pendingStep,
        pendingStepsForCurrentUser,
        acknowledgeStepsForCurrentUser,
        activeStageOrder,
        signatureFields,
        confirmedSignatureFields,
        documentWidth: template?.documentWidth ?? undefined,
        documentHeight: template?.documentHeight ?? undefined,
      },
    };
  }
  catch (error: any) {
    console.error('Error fetching signing status:', error);
    return { success: false, error: error.message || 'Failed to fetch signing status' };
  }
});
