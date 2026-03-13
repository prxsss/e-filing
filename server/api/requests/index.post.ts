import db from '../../../lib/db';
import { request } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware
    const body = await readBody(event);

    if (!body.templateId) {
      return {
        success: false,
        error: 'Template ID is required',
      };
    }

    // Create new request, always associating it with the authenticated user
    const newRequest = await db.insert(request).values({
      templateId: body.templateId,
      userId,
      status: 'draft',
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
