import { desc } from 'drizzle-orm';

import db from '../../../lib/db';
import { requestTemplate } from '../../../lib/db/schema/request-template';

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

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
