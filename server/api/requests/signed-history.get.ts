import db from '~~/lib/db';
import { request, requestTemplate, signatureFlow, users } from '~~/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware

    // Find all flow entries where this user was the signer (signed or rejected)
    // nullsLast ensures entries without a signedAt date don't float to the top
    const myFlows = await db
      .select()
      .from(signatureFlow)
      .where(eq(signatureFlow.signedBy, userId))
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
        userId: request.userId,
        requesterFirstNameTh: users.firstNameTh,
        requesterLastNameTh: users.lastNameTh,
        requesterFirstNameEn: users.firstNameEn,
        requesterLastNameEn: users.lastNameEn,
      })
      .from(request)
      .leftJoin(requestTemplate, eq(request.templateId, requestTemplate.id))
      .leftJoin(users, eq(request.userId, users.id))
      .where(inArray(request.id, requestIds));

    const requestMap = new Map(requestRows.map(r => [r.id, r]));

    const data = myFlows.map((flow) => {
      const req = requestMap.get(flow.requestId);
      const studentName = req
        ? (req.requesterFirstNameTh && req.requesterLastNameTh
            ? `${req.requesterFirstNameTh} ${req.requesterLastNameTh}`
            : `${req.requesterFirstNameEn ?? ''} ${req.requesterLastNameEn ?? ''}`.trim())
        : '-';

      return {
        flowId: flow.id,
        requestId: flow.requestId,
        stepOrder: flow.stepOrder,
        status: flow.status,
        signedAt: flow.signedAt,
        studentId: req?.userId ?? null,
        studentName,
        request: req ?? null,
      };
    });

    return { success: true, data };
  }
  catch (error: any) {
    console.error('Error fetching signed history:', error);
    return { success: false, error: error.message || 'Failed to fetch signing history' };
  }
});
