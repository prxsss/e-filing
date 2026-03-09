import { asc, eq } from 'drizzle-orm';

import db from '../../../../lib/db';
import { request, requestTemplate, signatureFlow, userRoles } from '../../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return { success: false, error: 'Invalid request ID' };
    }

    const session = await getUserSession(event);
    if (!session?.user?.id) {
      throw createError({ statusCode: 401, message: 'Unauthorized' });
    }

    // Get the current user's role IDs to determine if it's their turn to sign
    const userRoleRows = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, session.user.id));

    const userRoleIds = userRoleRows.map(r => r.roleId);

    const [requestData] = await db
      .select()
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (!requestData) {
      return { success: false, error: 'Request not found' };
    }

    const [template] = await db
      .select({ name: requestTemplate.name, signingFlowData: requestTemplate.signingFlowData })
      .from(requestTemplate)
      .where(eq(requestTemplate.id, Number(requestData.templateId)))
      .limit(1);

    const flowSteps = await db
      .select()
      .from(signatureFlow)
      .where(eq(signatureFlow.requestId, requestId))
      .orderBy(asc(signatureFlow.stepOrder));

    // Determine whether the current user may act on the pending step.
    // Mirrors the same dual-pattern routing used in for-signing.get.ts:
    //   Pattern A — direct assignment: assignedUserId === me (role not required)
    //   Pattern B — role queue:        assignedUserId is null AND roleId ∈ userRoles
    const overallPendingStep = flowSteps.find(s => s.status === 'pending') ?? null;
    const isCurrentUsersTurn = overallPendingStep !== null && (
      overallPendingStep.assignedUserId === session.user.id
      || (overallPendingStep.assignedUserId === null && userRoleIds.includes(overallPendingStep.roleId))
    );
    const pendingStep = isCurrentUsersTurn ? overallPendingStep : null;

    return {
      success: true,
      data: {
        requestId,
        status: requestData.status,
        filledDocumentUrl: requestData.filledDocumentUrl,
        templateName: template?.name ?? null,
        flowSteps,
        pendingStep,
      },
    };
  }
  catch (error: any) {
    console.error('Error fetching signing status:', error);
    return { success: false, error: error.message || 'Failed to fetch signing status' };
  }
});
