import db from '~~/lib/db';
import { departments, faculties, permissions, rolePermissions, roles, userRoles, users } from '~~/lib/db/schema';
import { USER_STATUS } from '~~/shared/types/user-status';
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
      studentId: users.studentId,
      staffId: users.staffId,
      provider: users.provider,
      titleEn: users.titleEn,
      fullNameEn: sql<string>`
          concat_ws(' ', ${users.firstNameEn}, ${users.lastNameEn})
        `,
      titleTh: users.titleTh,
      fullNameTh: sql<string>`
          concat_ws(' ', ${users.firstNameTh}, ${users.lastNameTh})
        `,
      email: users.email,
      passwordHash: users.passwordHash,
      status: users.status,
    })
    .from(users)
    .where(eq(users.email, body.email));
  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' });
  }

  if (user.provider === 'ku-all-login') {
    throw createError({
      statusCode: 400,
      message: 'This email is registered with KU ALL-Login. Please sign in with KU ALL-Login method.',
    });
  }

  if (user.status === USER_STATUS.INACTIVE) {
    throw createError({ statusCode: 403, message: 'Account is not activated.' });
  }

  if (user.status === USER_STATUS.BANNED) {
    throw createError({ statusCode: 403, message: 'Account is banned.' });
  }

  // We can assert that passwordHash is not null here because the user must have a password to be active
  const passwordMatch = await verifyPassword(user.passwordHash!, body.password);
  if (!passwordMatch) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' });
  }

  const [userAuth] = await db
    .select({
      roles: sql<string[]>`coalesce(array_agg(DISTINCT ${roles.name}), '{}')`,
      rolesTh: sql<string[]>`coalesce(array_agg(DISTINCT ${roles.nameTh}), '{}')`,
      permissions: sql<string[]>`coalesce(array_agg(DISTINCT ${permissions.code}), '{}')`,
      facultyNameTh: sql<string | null>`max(${faculties.nameTh})`,
      departmentCode: sql<string | null>`max(${departments.departmentCode})`,
      departmentNameTh: sql<string | null>`max(${departments.nameTh})`,
    })
    .from(userRoles)
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .leftJoin(faculties, eq(userRoles.facultyId, faculties.id))
    .leftJoin(departments, eq(userRoles.departmentId, departments.id))
    .where(eq(userRoles.userId, user.id));

  await setUserSession(event, {
    user: {
      id: user.id,
      titleEn: user.titleEn || undefined,
      fullNameEn: user.fullNameEn,
      titleTh: user.titleTh || undefined,
      fullNameTh: user.fullNameTh,
      roles: userAuth.roles,
      rolesTh: userAuth.rolesTh,
      currentRole: userAuth.roles[0],
      permissions: userAuth.permissions,
      email: user.email,
      studentId: user.studentId || undefined,
      staffId: user.staffId || undefined,
      facultyNameTh: userAuth.facultyNameTh || undefined,
      departmentCode: userAuth.departmentCode || undefined,
      departmentNameTh: userAuth.departmentNameTh || undefined,
      authProvider: 'local',
    },
    lastLoggedIn: new Date(),
  });

  return {
    success: true,
    user:
    {
      id: user.id,
      studentId: user.studentId || undefined,
      staffId: user.staffId || undefined,
      email: user.email,
      fullNameEn: user.fullNameEn,
      fullNameTh: user.fullNameTh,
      titleEn: user.titleEn || undefined,
      titleTh: user.titleTh || undefined,
      facultyNameTh: userAuth.facultyNameTh || undefined,
      departmentCode: userAuth.departmentCode || undefined,
      departmentNameTh: userAuth.departmentNameTh || undefined,
      roles: userAuth.roles,
      rolesTh: userAuth.rolesTh,
      currentRole: userAuth.roles[0],
      permissions: userAuth.permissions,
    },
  };
});
