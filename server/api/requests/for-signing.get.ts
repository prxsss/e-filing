import { eq, inArray } from 'drizzle-orm';

import db from '../../../lib/db';
import { request, requestTemplate, signatureFlow } from '../../../lib/db/schema';

export default defineEventHandler(async (_event) => {
  try {
    // แสดงทุก pending step (ชั่วคราวเพื่อทดสอบ ยังไม่กรอง role)
    const pendingFlows = await db
      .select()
      .from(signatureFlow)
      .where(eq(signatureFlow.status, 'pending'));

    if (pendingFlows.length === 0) {
      return { success: true, data: [] };
    }

    const requestIds = [...new Set(pendingFlows.map(f => f.requestId))] as number[];

    const requestRows = await db
      .select({
        id: request.id,
        status: request.status,
        submittedAt: request.submittedAt,
        filledDocumentUrl: request.filledDocumentUrl,
        createdBy: request.createdBy,
        templateName: requestTemplate.name,
        templateId: request.templateId,
      })
      .from(request)
      .leftJoin(requestTemplate, eq(request.templateId, requestTemplate.id))
      .where(inArray(request.id, requestIds));

    const data = pendingFlows.map((flow) => {
      const req = requestRows.find(r => r.id === flow.requestId);
      return {
        flowId: flow.id,
        requestId: flow.requestId,
        stepId: flow.stepId,
        stepOrder: flow.stepOrder,
        roleId: flow.roleId,
        roleName: flow.roleName,
        assignedFieldInstanceIds: flow.assignedFieldInstanceIds as string[],
        createdAt: flow.createdAt,
        request: req ?? null,
        studentName: 'นักศึกษา',
      };
    });

    return { success: true, data };
  }
  catch (error: any) {
    console.error('Error fetching signing tasks:', error);
    return { success: false, error: error.message || 'Failed to fetch signing tasks' };
  }
});
