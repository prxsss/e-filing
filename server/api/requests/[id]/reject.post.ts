import { and, asc, eq } from 'drizzle-orm';

import db from '../../../../lib/db';
import { request, signatureFlow, userRoles } from '../../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return { success: false, error: 'Invalid request ID' };
    }

    const body = await readBody(event);
    const reason = (body?.reason as string | undefined)?.trim() ?? '';
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware

    if (!reason) {
      return { success: false, error: 'กรุณาระบุเหตุผลในการปฏิเสธ' };
    }

    if (reason.length > 1000) {
      return { success: false, error: 'เหตุผลต้องไม่เกิน 1,000 ตัวอักษร' };
    }

    // Get user's role IDs
    const userRoleRows = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    const userRoleIds = userRoleRows.map(r => r.roleId);

    // Find current pending flow entry
    const pendingFlows = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.status, 'pending'),
      ))
      .orderBy(asc(signatureFlow.stepOrder))
      .limit(1);

    const flowEntry = pendingFlows[0];

    if (!flowEntry) {
      return { success: false, error: 'ไม่พบขั้นตอนที่รอดำเนินการสำหรับคำร้องนี้' };
    }

    // Authorization: same dual-pattern as sign.post.ts
    const isAuthorized
      = flowEntry.assignedUserId === userId
        || (flowEntry.assignedUserId === null && userRoleIds.includes(flowEntry.roleId));

    if (!isAuthorized) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ปฏิเสธในขั้นตอนนี้' };
    }

    const [requestData] = await db
      .select({ status: request.status })
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (!requestData) {
      return { success: false, error: 'ไม่พบคำร้องนี้' };
    }

    if (requestData.status === 'rejected' || requestData.status === 'completed') {
      return { success: false, error: 'คำร้องนี้ดำเนินการเสร็จสิ้นแล้ว ไม่สามารถปฏิเสธได้' };
    }

    // Mark the current step as rejected
    await db
      .update(signatureFlow)
      .set({ status: 'rejected', signedBy: userId, signedAt: new Date() })
      .where(eq(signatureFlow.id, flowEntry.id));

    // Cancel all remaining waiting steps
    await db
      .update(signatureFlow)
      .set({ status: 'cancelled' })
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.status, 'waiting'),
      ));

    // Update the request: status → rejected, store reason in note
    await db
      .update(request)
      .set({ status: 'rejected', note: reason })
      .where(eq(request.id, requestId));

    return {
      success: true,
      data: {
        status: 'rejected',
        rejectedBy: flowEntry.roleName,
        reason,
      },
    };
  }
  catch (error: any) {
    console.error('Error rejecting request:', error);
    return { success: false, error: error.message || 'เกิดข้อผิดพลาดในการปฏิเสธคำร้อง' };
  }
});
