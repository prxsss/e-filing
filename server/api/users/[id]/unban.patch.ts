import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string;

  const [user] = await db.select().from (users).where(eq(users.id, id));
  if (!user) {
    throw createError({
      statusCode: 404,
      message: `User with id ${id} not found`,
    });
  }

  if (!user.banned) {
    throw createError({
      statusCode: 400,
      message: `User with id ${id} is not banned`,
    });
  }

  const [updatedUser] = await db.update(users).set({ banned: false, banReason: null }).where(eq(users.id, id)).returning();

  return {
    id: updatedUser.id,
    banned: updatedUser.banned,
    banReason: updatedUser.banReason,
    unbannedAt: new Date(),
  };
});
