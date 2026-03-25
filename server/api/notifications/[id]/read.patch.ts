import { eq } from 'drizzle-orm';

import db from '../../../../lib/db';
import { notifications } from '../../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const notificationId = Number.parseInt(getRouterParam(event, 'id') || '0');
    const userId = event.context.user!.id;

    if (!notificationId) {
      return {
        success: false,
        error: 'Invalid notification ID',
      };
    }

    // Ownership check — only the notification owner may mark it as read
    const [existing] = await db
      .select({ userId: notifications.userId })
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Notification not found' };
    }

    if (existing.userId !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' });
    }

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));

    return {
      success: true,
    };
  }
  catch (error: any) {
    console.error('Error marking notification as read:', error);
    return {
      success: false,
      error: error.message || 'Failed to mark notification as read',
    };
  }
});
