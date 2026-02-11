import type { H3Event } from 'h3';

import { eq } from 'drizzle-orm';

import db from '../../../lib/db';
import { requestTemplate } from '../../../lib/db/schema/request-template';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const id = getRouterParam(event, 'id');

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'Template ID is required',
      });
    }

    const template = await db
      .select()
      .from(requestTemplate)
      .where(eq(requestTemplate.id, Number(id)))
      .limit(1);

    if (!template || template.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Template not found',
      });
    }

    return {
      success: true,
      data: template[0],
    };
  }
  catch (error: any) {
    console.error('Error fetching template:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch template',
    });
  }
});
