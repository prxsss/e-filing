import db from '~~/lib/db';
import { roles, userRoles, users } from '~~/lib/db/schema';
import { USER_STATUS } from '~~/shared/types/user-status';
import { eq, sql } from 'drizzle-orm';
import * as z from 'zod';

const banSchema = z.object({
  banReason: z.string().min(1, 'Ban reason is required'),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.status');

  const id = getRouterParam(event, 'id') as string;

  if (event.context.user?.id === id) {
    throw createError({
      statusCode: 400,
      message: 'You cannot ban your own account',
    });
  }

  const body = await readValidatedBody(event, banSchema.parse);

  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) {
    throw createError({
      statusCode: 404,
      message: `User with id ${id} not found`,
    });
  }

  if (user.status === USER_STATUS.BANNED) {
    throw createError({
      statusCode: 400,
      message: `User with id ${id} is already banned`,
    });
  }

  const [adminRoleAssignment] = await db
    .select({
      roleId: userRoles.roleId,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(sql`${userRoles.userId} = ${id} and lower(${roles.name}) = 'admin'`)
    .limit(1);

  if (adminRoleAssignment) {
    const [otherUnbannedAdminCount] = await db
      .select({
        count: sql<number>`cast(count(distinct ${userRoles.userId}) as int)`,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(sql`lower(${roles.name}) = 'admin' and ${users.status} <> ${USER_STATUS.BANNED} and ${userRoles.userId} <> ${id}`);

    if ((otherUnbannedAdminCount?.count ?? 0) < 1) {
      throw createError({
        statusCode: 409,
        message: 'Cannot ban the last admin user in the system',
        data: {
          code: 'LAST_ADMIN_BAN_LOCKED',
        },
      });
    }
  }

  const [updatedUser] = await db.update(users).set({ status: USER_STATUS.BANNED, banReason: body.banReason, updatedAt: new Date().toISOString() }).where(eq(users.id, id)).returning();

  return {
    id: updatedUser.id,
    status: updatedUser.status,
    banReason: updatedUser.banReason,
    bannedAt: new Date(),
  };
});
