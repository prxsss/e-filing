import type { H3Event } from 'h3';

import { desc } from 'drizzle-orm';

import db from '../../../lib/db';
import { requestTemplate } from '../../../lib/db/schema/request-template';

export default defineEventHandler(async (_event: H3Event) => {
  try {
    const templates = await db
      .select()
      .from(requestTemplate)
      .orderBy(desc(requestTemplate.createdAt));

    return {
      success: true,
      data: templates,
    };
  }
  catch (error: any) {
    console.error('Error fetching templates:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch templates',
    });
  }
});
