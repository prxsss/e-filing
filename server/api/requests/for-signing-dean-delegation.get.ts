import db from '~~/lib/db';
import { getActiveDelegationsForUser } from '~~/lib/db/queries/dean-delegation';
import { request, requestTemplate, roles, signatureFlow, userRoles, users } from '~~/lib/db/schema';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const userId = event.context.user!.id;

    const userRoleRows = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    const userRoleIds = userRoleRows.map(r => r.roleId);

    const regularRoutingCondition = userRoleIds.length > 0
      ? or(
          eq(signatureFlow.assignedUserId, userId),
          and(
            isNull(signatureFlow.assignedUserId),
            inArray(signatureFlow.roleId, userRoleIds),
          ),
        )
      : eq(signatureFlow.assignedUserId, userId);

    const regularPendingFlows = await db
      .select({ id: signatureFlow.id })
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.status, 'pending'),
        regularRoutingCondition,
      ));

    const regularFlowIds = new Set(regularPendingFlows.map(f => f.id));

    const userDelegations = await getActiveDelegationsForUser(userId);
    if (userDelegations.length === 0) {
      return { success: true, data: [] };
    }

    const [deanRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(sql`lower(${roles.name}) = 'dean'`)
      .limit(1);

    if (!deanRole) {
      return { success: true, data: [] };
    }

    const flowMap = new Map<number, { signature_flow: typeof signatureFlow.$inferSelect; roles: typeof roles.$inferSelect | null }>();

    for (const delegation of userDelegations) {
      const templateFilter = delegation.allowedTemplateIds.length > 0
        ? inArray(request.templateId, delegation.allowedTemplateIds)
        : undefined;

      const flows = await db
        .select({
          signature_flow: signatureFlow,
          roles,
        })
        .from(signatureFlow)
        .leftJoin(roles, eq(signatureFlow.roleId, roles.id))
        .innerJoin(request, eq(signatureFlow.requestId, request.id))
        .where(and(
          eq(signatureFlow.status, 'pending'),
          eq(signatureFlow.roleId, deanRole.id),
          eq(request.facultyId, delegation.facultyId),
          templateFilter,
        ));

      for (const flow of flows) {
        if (!regularFlowIds.has(flow.signature_flow.id) && !flowMap.has(flow.signature_flow.id)) {
          flowMap.set(flow.signature_flow.id, flow);
        }
      }
    }

    const deanDelegationFlows = Array.from(flowMap.values());
    if (deanDelegationFlows.length === 0) {
      return { success: true, data: [] };
    }

    const requestIds = [...new Set(deanDelegationFlows.map(f => f.signature_flow.requestId))] as number[];

    const requestRows = await db
      .select({
        id: request.id,
        status: request.status,
        submittedAt: request.submittedAt,
        filledDocumentUrl: request.filledDocumentUrl,
        templateName: requestTemplate.name,
        templateId: request.templateId,
        userId: request.userId,
        requesterNameEn: sql<string>`concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ' ', ${users.lastNameEn})`,
        requesterNameTh: sql<string>`concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`,
      })
      .from(request)
      .leftJoin(requestTemplate, eq(request.templateId, requestTemplate.id))
      .leftJoin(users, eq(request.userId, users.id))
      .where(inArray(request.id, requestIds));

    const data = deanDelegationFlows.map((flow) => {
      const req = requestRows.find(r => r.id === flow.signature_flow.requestId);

      return {
        flowId: flow.signature_flow.id,
        requestId: flow.signature_flow.requestId,
        stepId: flow.signature_flow.stepId,
        stepOrder: flow.signature_flow.stepOrder,
        roleId: flow.signature_flow.roleId,
        roleDescriptionEn: flow.roles?.descriptionEn,
        roleDescriptionTh: flow.roles?.descriptionTh,
        assignedFieldInstanceIds: flow.signature_flow.assignedFieldInstanceIds as string[],
        acknowledgeOnly: flow.signature_flow.acknowledgeOnly,
        createdAt: flow.signature_flow.createdAt,
        studentNameEn: req?.requesterNameEn ?? '-',
        studentNameTh: req?.requesterNameTh ?? '-',
        request: req
          ? {
              id: req.id,
              status: req.status,
              submittedAt: req.submittedAt,
              filledDocumentUrl: req.filledDocumentUrl,
              templateName: req.templateName,
              templateId: req.templateId,
              userId: req.userId,
            }
          : null,
      };
    }).sort((a, b) => {
      const dateA = a.request?.submittedAt ? new Date(a.request.submittedAt).getTime() : 0;
      const dateB = b.request?.submittedAt ? new Date(b.request.submittedAt).getTime() : 0;
      return dateA - dateB;
    });

    return { success: true, data };
  }
  catch (error: any) {
    console.error('Error fetching dean delegation signing tasks:', error);
    return { success: false, error: error.message || 'Failed to fetch delegation signing tasks' };
  }
});
