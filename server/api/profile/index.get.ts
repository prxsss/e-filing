import db from '~~/lib/db';
import { permissions, rolePermissions, roles, userRoles, users } from '~~/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'request.sign');

  const user = event.context.user!; // We can assert this because of the require-auth middleware

  const [profile] = await db
    .select({
      id: users.id,
      titleEn: users.titleEn,
      firstNameEn: users.firstNameEn,
      lastNameEn: users.lastNameEn,
      titleTh: users.titleTh,
      firstNameTh: users.firstNameTh,
      lastNameTh: users.lastNameTh,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!profile) {
    throw createError({
      statusCode: 404,
      message: 'User profile not found',
    });
  }

  const signableRoles = await db
    .select({
      id: roles.id,
      name: roles.name,
      nameTh: roles.nameTh,
    })
    .from(roles)
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(permissions.code, 'request.sign'))
    .groupBy(roles.id)
    .orderBy(roles.name);

  const activeSignRoles = await db
    .select({
      roleId: userRoles.roleId,
      facultyId: userRoles.facultyId,
      departmentId: userRoles.departmentId,
    })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(
      eq(userRoles.userId, user.id),
      eq(permissions.code, 'request.sign'),
    ));

  return {
    profile: {
      ...profile,
      roleAssignments: activeSignRoles,
    },
    roles: signableRoles,
  };
});
