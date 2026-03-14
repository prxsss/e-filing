import { eq } from 'drizzle-orm';

import db from '../../../lib/db';
import { request } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware
    const body = await readBody(event);

    if (!requestId) {
      return {
        success: false,
        error: 'Invalid request ID',
      };
    }

    // Ownership check — only the request owner may patch it
    const [existing] = await db
      .select({ userId: request.userId })
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Request not found' };
    }

    if (existing.userId !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' });
    }

    // Allowlist: only draft-stage fields may be patched by the owner
    const allowedStatuses = ['draft', 'submitted'] as const;
    type AllowedStatus = typeof allowedStatuses[number];
    const newStatus: AllowedStatus | undefined = allowedStatuses.includes(body.status)
      ? body.status as AllowedStatus
      : undefined;

    if (body.status !== undefined && !newStatus) {
      return { success: false, error: 'Invalid status value' };
    }

    // Update request
    await db
      .update(request)
      .set({
        ...(newStatus ? { status: newStatus } : {}),
        ...(body.submittedAt ? { submittedAt: new Date(body.submittedAt).toISOString() } : {}),
      })
      .where(eq(request.id, requestId));

    return {
      success: true,
    };
  }
  catch (error: any) {
    console.error('Error updating request:', error);
    return {
      success: false,
      error: error.message || 'Failed to update request',
    };
  }
});
