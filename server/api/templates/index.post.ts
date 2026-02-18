import type { H3Event } from 'h3';

import db from '../../../lib/db';
import { requestTemplate } from '../../../lib/db/schema/request-template';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const body = await readBody(event);

    // Validate required fields
    if (!body.name || !body.placedFieldsData) {
      throw createError({
        statusCode: 400,
        message: 'Missing required fields: name and placedFieldsData',
      });
    }

    // Insert into database
    const result = await db.insert(requestTemplate).values({
      name: body.name,
      description: body.description || null,
      category: body.category || null,
      version: body.version || '1.0.0',
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdBy: body.createdBy || null,
      documentUrl: body.documentUrl || null,
      documentWidth: body.documentWidth || null,
      documentHeight: body.documentHeight || null,
      placedFieldsData: body.placedFieldsData,
    }).returning();

    return {
      success: true,
      data: result[0],
    };
  }
  catch (error: any) {
    console.error('Error saving template:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to save template',
    });
  }
});
