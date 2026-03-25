import db from '~~/lib/db';
import { notifications } from '~~/lib/db/schema';
import { and, desc, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const userId = event.context.user!.id;
    const { isRead } = getQuery(event);

    // Default to unread (false) when no query param is provided
    const isReadBool = isRead === undefined ? false : isRead === 'true' || isRead === true;

    const result = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, isReadBool)))
      .orderBy(desc(notifications.createdAt));

    return {
      success: true,
      data: result,
    };
  }
  catch (error: any) {
    console.error('Error fetching notifications:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch notifications',
    };
  }
});
