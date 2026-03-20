import db from '~~/lib/db';
import { request, requestTemplate, signatureFlow, userRoles, users } from '~~/lib/db/schema';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware

    // Resolve the current user's role IDs for role-based routing
    const userRoleRows = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    const userRoleIds = userRoleRows.map(r => r.roleId);

    // DocuSign-style routing — a pending step is visible to this user when:
    //   Pattern A (Direct assignment): assignedUserId is explicitly set to this user
    //     → used when the student picks a specific person (e.g. "อาจารย์ A")
    //   Pattern B (Role-based routing): no specific person was chosen AND the step's
    //     roleId matches one of this user's roles
    //     → used for generic role queues
    //
    // The two patterns are independent ORs. Pattern A works even if the user has no
    // roles; Pattern B is only evaluated when the user has at least one role.
    const routingCondition = userRoleIds.length > 0
      ? or(
          eq(signatureFlow.assignedUserId, userId),
          and(
            isNull(signatureFlow.assignedUserId),
            inArray(signatureFlow.roleId, userRoleIds),
          ),
        )
      : eq(signatureFlow.assignedUserId, userId);

    const allPendingFlows = await db
      .select()
      .from(signatureFlow)
      .where(
        and(
          eq(signatureFlow.status, 'pending'),
          routingCondition,
        ),
      );

    if (allPendingFlows.length === 0) {
      return { success: true, data: [] };
    }

    const requestIds = [...new Set(allPendingFlows.map(f => f.requestId))] as number[];

    // Fetch request details and join requester name (for "จาก:" label in UI)
    const requestRows = await db
      .select({
        id: request.id,
        status: request.status,
        submittedAt: request.submittedAt,
        filledDocumentUrl: request.filledDocumentUrl,
        templateName: requestTemplate.name,
        templateId: request.templateId,
        userId: request.userId, // ← add this
        requesterFirstNameTh: users.firstNameTh,
        requesterLastNameTh: users.lastNameTh,
        requesterFirstNameEn: users.firstNameEn,
        requesterLastNameEn: users.lastNameEn,
      })
      .from(request)
      .leftJoin(requestTemplate, eq(request.templateId, requestTemplate.id))
      .leftJoin(users, eq(request.userId, users.id))
      .where(inArray(request.id, requestIds));

    const data = allPendingFlows.map((flow) => {
      const req = requestRows.find(r => r.id === flow.requestId);

      // Prefer Thai name; fall back to English name
      const studentName = req
        ? (req.requesterFirstNameTh && req.requesterLastNameTh
            ? `${req.requesterFirstNameTh} ${req.requesterLastNameTh}`
            : `${req.requesterFirstNameEn ?? ''} ${req.requesterLastNameEn ?? ''}`.trim())
        : '-';

      return {
        flowId: flow.id,
        requestId: flow.requestId,
        stepId: flow.stepId,
        stepOrder: flow.stepOrder,
        roleId: flow.roleId,
        roleName: flow.roleName,
        assignedFieldInstanceIds: flow.assignedFieldInstanceIds as string[],
        createdAt: flow.createdAt,
        studentName,
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
    });

    return { success: true, data };
  }
  catch (error: any) {
    console.error('Error fetching signing tasks:', error);
    return { success: false, error: error.message || 'Failed to fetch signing tasks' };
  }
});
