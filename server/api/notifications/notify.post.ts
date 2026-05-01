import db from '~~/lib/db';
import { notifications, notificationType } from '~~/lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const nitroApp = useNitroApp() as any;

    // Allowed notification types from enum
    const allowedTypes = notificationType.enumValues;

    const messageEng = body.messageEng ?? body.message_eng ?? body.message ?? null;
    const messageTh = body.messageTh ?? body.message_th ?? null;

    // Validate required fields
    if (!body.userId || (!messageEng && !messageTh) || !body.type) {
      return {
        success: false,
        error: 'userId, messageEng/messageTh, and type are required',
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
      messageEng,
      messageTh,
      type: body.type,
      link: body.link ?? null,
      isRead: false,
    };

    // Insert notification into DB
    const [notification] = await db.insert(notifications).values(notificationData).returning();

    // Emit notification via socket with error handling
    try {
      nitroApp.io.to(body.userId).emit('notification', notification);
    }
    catch (socketErr: any) {
      if (socketErr && socketErr.code === 'ECONNABORTED') {
        console.error('[Socket ECONNABORTED]', socketErr);
      }
      else {
        console.error('[Socket emit error]', socketErr);
      }
      // Optionally, you could return a more descriptive error here
    }

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
