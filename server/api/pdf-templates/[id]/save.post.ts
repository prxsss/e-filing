import type { H3Event } from 'h3';

import { eq } from 'drizzle-orm';

import db from '../../../../lib/db';
import { requestTemplate } from '../../../../lib/db/schema';

export default defineEventHandler(async (event: H3Event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const templateId = getRouterParam(event, 'id');

    if (!templateId) {
      throw createError({
        statusCode: 400,
        message: 'Template ID is required',
      });
    }

    const body = await readBody(event);

    if (!body.name || !body.placedFieldsData) {
      throw createError({
        statusCode: 400,
        message: 'Missing required fields: name, placedFieldsData',
      });
    }

    // For now, we'll keep the original composite URL or use an empty string
    // File storage operations should be handled separately or through a different endpoint
    const compositeImageUrl = body.originalCompositeUrl || '';

    // Update template in database
    const updateResult = await db
      .update(requestTemplate)
      .set({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        documentUrl: compositeImageUrl || undefined,
        documentWidth: body.documentWidth || null,
        documentHeight: body.documentHeight || null,
        placedFieldsData: body.placedFieldsData,
        signingFlowData: body.signingFlowData || null,
      })
      .where(eq(requestTemplate.id, Number(templateId)))
      .returning();

    if (!updateResult || updateResult.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Template not found or could not be updated',
      });
    }

    return {
      success: true,
      data: updateResult[0],
    };
  }
  catch (error: any) {
    console.error('Error saving template:', error);

    // If it's already an H3 error, re-throw it
    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to save template',
    });
  }
});
