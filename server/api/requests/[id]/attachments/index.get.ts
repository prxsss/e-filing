import type { H3Event } from 'h3';

import { eq } from 'drizzle-orm';

import db from '../../../../../lib/db';
import { attachments } from '../../../../../lib/db/schema';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const requestId = event.context.params?.id;

    if (!requestId) {
      throw createError({
        statusCode: 400,
        message: 'Request ID is required',
      });
    }

    // Get all attachments for this request
    const requestAttachments = await db
      .select()
      .from(attachments)
      .where(eq(attachments.requestId, Number(requestId)))
      .orderBy(attachments.createdAt);

    return {
      success: true,
      data: requestAttachments,
    };
  }
  catch (error: any) {
    console.error('Error fetching attachments:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch attachments',
    };
  }
});
