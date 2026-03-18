import { eq } from 'drizzle-orm';

import db from '../../../../lib/db';
import { requestTemplate } from '../../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  const id = Number.parseInt(getRouterParam(event, 'id') || '', 10);
  if (Number.isNaN(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid template ID' });
  }

  try {
    const body = await readBody<Record<string, unknown> | null>(event);
    const rawDescription = body?.description;
    const normalizedDescription = rawDescription === null || rawDescription === undefined
      ? null
      : String(rawDescription).trim() || null;

    const updatedTemplates = await db
      .update(requestTemplate)
      .set({ description: normalizedDescription })
      .where(eq(requestTemplate.id, id))
      .returning({
        id: requestTemplate.id,
        description: requestTemplate.description,
      });

    if (updatedTemplates.length === 0) {
      throw createError({ statusCode: 404, message: 'Template not found' });
    }

    return {
      success: true,
      data: updatedTemplates[0],
    };
  }
  catch (error: any) {
    if (error?.statusCode) {
      throw error;
    }

    console.error('Error updating request detail:', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      stack: error?.stack,
    });
    throw createError({
      statusCode: 500,
      message: error?.message || 'Failed to update request detail',
    });
  }
});
