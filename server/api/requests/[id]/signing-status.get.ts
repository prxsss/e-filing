import { asc, eq } from 'drizzle-orm';

import db from '../../../../lib/db';
import { request, requestTemplate, signatureFlow } from '../../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return { success: false, error: 'Invalid request ID' };
    }

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

    const pendingStep = flowSteps.find(s => s.status === 'pending') ?? null;

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
