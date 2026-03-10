import { desc, eq, inArray } from 'drizzle-orm';

import db from '../../../lib/db';
import { request, requestTemplate, signatureFlow } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event);
    if (!session?.user?.id) {
      throw createError({ statusCode: 401, message: 'Unauthorized' });
    }

    // Find all flow entries where this user was the signer (signed or rejected)
    // nullsLast ensures entries without a signedAt date don't float to the top
    const myFlows = await db
      .select()
      .from(signatureFlow)
      .where(eq(signatureFlow.signedBy, session.user.id))
      .orderBy(desc(signatureFlow.signedAt));

    if (myFlows.length === 0) {
      return { success: true, data: [] };
    }

    const requestIds = [...new Set(myFlows.map(f => f.requestId))] as number[];

    const requestRows = await db
      .select({
        id: request.id,
        status: request.status,
        note: request.note,
        submittedAt: request.submittedAt,
        filledDocumentUrl: request.filledDocumentUrl,
        templateName: requestTemplate.name,
      })
      .from(request)
      .leftJoin(requestTemplate, eq(request.templateId, requestTemplate.id))
      .where(inArray(request.id, requestIds));

    const requestMap = new Map(requestRows.map(r => [r.id, r]));

    const data = myFlows.map(flow => ({
      flowId: flow.id,
      requestId: flow.requestId,
      stepOrder: flow.stepOrder,
      roleName: flow.roleName,
      status: flow.status,
      signedAt: flow.signedAt,
      request: requestMap.get(flow.requestId) ?? null,
    }));

    return { success: true, data };
  }
  catch (error: any) {
    console.error('Error fetching signed history:', error);
    return { success: false, error: error.message || 'Failed to fetch signing history' };
  }
});
