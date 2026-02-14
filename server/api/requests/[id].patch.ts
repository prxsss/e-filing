import { eq } from 'drizzle-orm';

import db from '../../../lib/db';
import { request } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');
    const body = await readBody(event);

    if (!requestId) {
      return {
        success: false,
        error: 'Invalid request ID',
      };
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
