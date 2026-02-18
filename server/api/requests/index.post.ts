import db from '../../../lib/db';
import { request } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    if (!body.templateId) {
      return {
        success: false,
        error: 'Template ID is required',
      };
    }

    // Create new request
    const newRequest = await db.insert(request).values({
      templateId: body.templateId,
      createdBy: body.createdBy || null,
      status: body.status || 'draft',
      submittedAt: body.submittedAt || null,
    }).returning();

    return {
      success: true,
      data: newRequest[0],
    };
  }
  catch (error: any) {
    console.error('Error creating request:', error);
    return {
      success: false,
      error: error.message || 'Failed to create request',
    };
  }
});
