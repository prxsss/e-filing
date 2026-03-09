import { eq } from 'drizzle-orm';

import db from '../../../lib/db';
import { request } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event);
    if (!session?.user?.id) {
      throw createError({ statusCode: 401, message: 'Unauthorized' });
    }

    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');
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

    if (existing.userId !== session.user.id) {
      throw createError({ statusCode: 403, message: 'Forbidden' });
    }

    // Update request
    await db
      .update(request)
      .set({
        status: body.status,
        submittedAt: body.submittedAt ? new Date(body.submittedAt) : null,
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
