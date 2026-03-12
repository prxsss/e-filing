import type { H3Event } from 'h3';

import { eq } from 'drizzle-orm';

import db from '../../../lib/db';
import { requestTemplate } from '../../../lib/db/schema/request-template';

export default defineEventHandler(async (event: H3Event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const id = getRouterParam(event, 'id');
    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'Template ID is required',
      });
    }

    const [deletedTemplate] = await db
      .delete(requestTemplate)
      .where(eq(requestTemplate.id, Number(id)))
      .returning();

    if (!deletedTemplate) {
      throw createError({
        statusCode: 404,
        message: 'Template not found',
      });
    }

    return {
      success: true,
      message: 'Template deleted successfully',
    };
  }
  catch (error: any) {
    console.error('Error deleting template:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to delete template',
    });
  }
});
