import { eq } from 'drizzle-orm';

import db from '../../../../lib/db';
import { requestTemplate } from '../../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  const id = Number.parseInt(getRouterParam(event, 'id') || '', 10);
  if (Number.isNaN(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid template ID' });
  }

  try {
    const body = await readBody<Record<string, unknown> | null>(event);
    const raw = body?.isActive;
    if (typeof raw !== 'boolean') {
      throw createError({ statusCode: 400, message: 'isActive (boolean) is required' });
    }

    const updated = await db
      .update(requestTemplate)
      .set({ isActive: raw })
      .where(eq(requestTemplate.id, id))
      .returning({ id: requestTemplate.id, isActive: requestTemplate.isActive });

    if (!updated || updated.length === 0) {
      throw createError({ statusCode: 404, message: 'Template not found' });
    }

    return {
      success: true,
      data: updated[0],
    };
  }
  catch (error: any) {
    if (error?.statusCode) {
      throw error;
    }
    console.error('Error updating template active state:', error);
    throw createError({ statusCode: 500, message: error?.message || 'Failed to update template active state' });
  }
});
