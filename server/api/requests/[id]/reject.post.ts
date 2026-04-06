import { signNotificationService } from '~~/server/services/sign-notification.service';
import { getSignRequestContext } from '~~/server/utils/get-sign-request-context';
import { and, asc, eq, sql } from 'drizzle-orm';

import db from '../../../../lib/db';
import { request, signatureFlow, userRoles, users } from '../../../../lib/db/schema';

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
      .orderBy(asc(signatureFlow.stepOrder));

    const flowEntry = pendingFlows.find(flow =>
      flow.assignedUserId === userId
      || (flow.assignedUserId === null && userRoleIds.includes(flow.roleId)),
    );

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

    const activeStepOrder = flowEntry.stepOrder;
    const stageEntries = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.stepOrder, activeStepOrder),
      ));

    const isParallelStage = stageEntries.length > 1;

    // Non-parallel stage: preserve existing full-request rejection behavior.
    if (!isParallelStage) {
      await db
        .update(signatureFlow)
        .set({ status: 'rejected', signedBy: userId, signedAt: new Date().toISOString() })
        .where(eq(signatureFlow.id, flowEntry.id));

      await db
        .update(signatureFlow)
        .set({ status: 'cancelled' })
        .where(and(
          eq(signatureFlow.requestId, requestId),
          eq(signatureFlow.status, 'waiting'),
        ));

      await db
        .update(request)
        .set({ status: 'rejected', note: reason })
        .where(eq(request.id, requestId));

      const [context, [signer], [template]] = await Promise.all([
        getSignRequestContext(requestId),

        db.select({
          signerName: sql<string>`
      concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
    `,
        })
          .from(users)
          .where(eq(users.id, userId)),

        db.select({ templateId: request.templateId })
          .from(request)
          .where(eq(request.id, requestId)),
      ]);
      await signNotificationService.notifyRejected({ signerName: signer.signerName }, { ...context, templateId: template.templateId }, reason);

      return {
        success: true,
        data: {
          status: 'rejected',
          rejectedBy: flowEntry.roleName,
          reason,
          rejectionMode: 'full_request',
        },
      };
    }

    // Parallel stage: reject only current signer's part.
    await db
      .update(signatureFlow)
      .set({ status: 'rejected', signedBy: userId, signedAt: new Date().toISOString() })
      .where(eq(signatureFlow.id, flowEntry.id));

    const updatedStageEntries = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.stepOrder, activeStepOrder),
      ));

    const stageResolved = updatedStageEntries.every(step => step.status === 'signed' || step.status === 'rejected');

    if (!stageResolved) {
      return {
        success: true,
        data: {
          status: requestData.status ?? 'in_progress',
          rejectedBy: flowEntry.roleName,
          reason,
          rejectionMode: 'local_step',
          nextRole: null,
        },
      };
    }

    const nextWaiting = await db
      .select()
      .from(signatureFlow)
      .where(and(
        eq(signatureFlow.requestId, requestId),
        eq(signatureFlow.status, 'waiting'),
      ))
      .orderBy(asc(signatureFlow.stepOrder))
      .limit(1);

    if (nextWaiting[0]) {
      const nextGroupOrder = nextWaiting[0].stepOrder;

      await db
        .update(signatureFlow)
        .set({ status: 'pending', pendingAt: new Date().toISOString() })
        .where(and(
          eq(signatureFlow.requestId, requestId),
          eq(signatureFlow.stepOrder, nextGroupOrder),
          eq(signatureFlow.status, 'waiting'),
        ));

      await db
        .update(request)
        .set({ status: 'in_progress' })
        .where(eq(request.id, requestId));

      const [context, nextSigners] = await Promise.all([
        getSignRequestContext(requestId),
        db.select({
          signerEmail: users.email,
          signerName: sql<string>`
      concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
    `,
          stepOrder: signatureFlow.stepOrder,
        })
          .from(signatureFlow)
          .innerJoin(users, eq(signatureFlow.assignedUserId, users.id))
          .where(and(
            eq(signatureFlow.requestId, requestId),
            eq(signatureFlow.stepOrder, nextGroupOrder),
          )),
      ]);

      if (nextSigners.length > 0) {
        await Promise.all(
          nextSigners.map(step => signNotificationService.notifySigner({
            signerEmail: step.signerEmail,
            signerName: step.signerName,
            stepOrder: step.stepOrder,
          }, context)),
        );
      }

      return {
        success: true,
        data: {
          status: 'in_progress',
          rejectedBy: flowEntry.roleName,
          reason,
          rejectionMode: 'local_step',
          nextRole: nextWaiting[0].roleName,
        },
      };
    }

    await db
      .update(request)
      .set({ status: 'completed', completedAt: new Date().toISOString() })
      .where(eq(request.id, requestId));

    return {
      success: true,
      data: {
        status: 'completed',
        rejectedBy: flowEntry.roleName,
        reason,
        rejectionMode: 'local_step',
        nextRole: null,
      },
    };
  }
  catch (error: any) {
    console.error('Error rejecting request:', error);
    return { success: false, error: error.message || 'เกิดข้อผิดพลาดในการปฏิเสธคำร้อง' };
  }
});
