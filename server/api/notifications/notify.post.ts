import db from '~~/lib/db';
import { notifications } from '~~/lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const io = (event.context.nitro as any).io;
    // Validate required fields
    if (!body.userId || !body.message) {
      return {
        success: false,
        error: 'userId and message are required',
      };
    }

    // Insert notification into DB
    const [notification] = await db.insert(notifications).values({
      userId: Number(body.userId),
      message: body.message,
      authUserId: event.context.user?.id ?? null,
      isRead: false,
    }).returning();

    // Emit notification via socket
    io.to(body.userId).emit('notification', notification);

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
