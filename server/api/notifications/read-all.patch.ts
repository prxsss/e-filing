import db from '~~/lib/db';
import { notifications } from '~~/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const userId = event.context.user!.id;

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return {
      success: true,
    };
  }
  catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    return {
      success: false,
      error: error.message || 'Failed to mark all notifications as read',
    };
  }
});
