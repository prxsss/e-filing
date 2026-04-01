import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import { USER_STATUS } from '~~/shared/types/user-status';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.status');

  const id = getRouterParam(event, 'id') as string;

  const [user] = await db.select().from (users).where(eq(users.id, id));
  if (!user) {
    throw createError({
      statusCode: 404,
      message: `User with id ${id} not found`,
    });
  }

  if (user.status !== USER_STATUS.BANNED) {
    throw createError({
      statusCode: 400,
      message: `User with id ${id} is not banned`,
    });
  }

  const [updatedUser] = await db.update(users).set({ status: USER_STATUS.ACTIVE, banReason: null, updatedAt: new Date().toISOString() }).where(eq(users.id, id)).returning();

  return {
    id: updatedUser.id,
    status: updatedUser.status,
    banReason: updatedUser.banReason,
    unbannedAt: new Date(),
  };
});
