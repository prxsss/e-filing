import db from '~~/lib/db';
import { notifications, notificationType } from '~~/lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const nitroApp = useNitroApp() as any;

    // Allowed notification types from enum
    const allowedTypes = notificationType.enumValues;

    // Validate required fields
    if (!body.userId || !body.message || !body.type) {
      return {
        success: false,
        error: 'userId, message, and type are required',
      };
    }

    if (!allowedTypes.includes(body.type)) {
      return {
        success: false,
        error: `Invalid notification type. Allowed types: ${allowedTypes.join(', ')}`,
      };
    }

    // Prepare notification data
    const notificationData = {
      userId: String(body.userId),
      message: body.message,
      type: body.type,
      link: body.link ?? null,
      isRead: false,
    };

    // Insert notification into DB
    const [notification] = await db.insert(notifications).values(notificationData).returning();

    // Emit notification via socket
    nitroApp.io.to(body.userId).emit('notification', notification);

    return {
      success: true,
      data: notification,
    };
  }
  catch (error: any) {
    console.error('Error creating notification:', error);
    return {
      success: false,
      error: error.message || 'Failed to create notification',
    };
  }
});
