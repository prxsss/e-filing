import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as z from 'zod';

const banSchema = z.object({
  banReason: z.string().min(1, 'Ban reason is required'),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.status');

  const id = getRouterParam(event, 'id') as string;

  const body = await readValidatedBody(event, banSchema.parse);

  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) {
    throw createError({
      statusCode: 404,
      message: `User with id ${id} not found`,
    });
  }

  if (user.banned) {
    throw createError({
      statusCode: 400,
      message: `User with id ${id} is already banned`,
    });
  }

  const [updatedUser] = await db.update(users).set({ banned: true, banReason: body.banReason }).where(eq(users.id, id)).returning();

  return {
    id: updatedUser.id,
    banned: updatedUser.banned,
    banReason: updatedUser.banReason,
    bannedAt: new Date(),
  };
});
