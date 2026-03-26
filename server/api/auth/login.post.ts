import db from '~~/lib/db';
import { permissions, rolePermissions, roles, userRoles, users } from '~~/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import * as zod from 'zod';

const loginSchema = zod.object({
  email: zod.email(),
  password: zod.string(),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, loginSchema.parse);

  const [user] = await db
    .select({
      id: users.id,
      fullNameEn: sql<string>`
          concat_ws(' ', ${users.academicRankEn}, ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})
        `,
      fullNameTh: sql<string>`
          concat_ws(' ', ${users.academicRankTh}, ${users.titleTh}, ${users.firstNameTh}, ${users.lastNameTh})
        `,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      banned: users.banExpires,
    })
    .from(users)
    .where(eq(users.email, body.email));
  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' });
  }
  if (!user.isActive) {
    throw createError({ statusCode: 403, message: 'Account is not activated.' });
  }

  // We can assert that passwordHash is not null here because the user must have a password to be active
  const passwordMatch = await verifyPassword(user.passwordHash!, body.password);
  if (!passwordMatch) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' });
  }

  const [userAuth] = await db
    .select({
      roles: sql<string[]>`array_agg(DISTINCT ${roles.name})`,
      permissions: sql<string[]>`array_agg(DISTINCT ${permissions.code})`,
    })
    .from(userRoles)
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, user.id));

  await setUserSession(event, {
    user: {
      id: user.id,
      fullNameEn: user.fullNameEn,
      fullNameTh: user.fullNameTh,
      roles: userAuth.roles,
      currentRole: userAuth.roles[0],
      permissions: userAuth.permissions,
    },
    lastLoggedIn: new Date(),
  });

  return {
    success: true,
    user:
    {
      id: user.id,
      email: user.email,
      fullNameEn: user.fullNameEn,
      fullNameTh: user.fullNameTh,
      roles: userAuth.roles,
      currentRole: userAuth.roles[0],
      permissions: userAuth.permissions,
    },
  };
});
