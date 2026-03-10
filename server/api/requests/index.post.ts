import db from '../../../lib/db';
import { request } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event);
    if (!session?.user?.id) {
      throw createError({ statusCode: 401, message: 'Unauthorized' });
    }

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
      userId: session.user.id,
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
