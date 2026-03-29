import { and, eq, sql } from 'drizzle-orm';

import db from '..';
import { roles, userRoles } from '../schema';

function isStudentRoleName(name?: string | null) {
  if (!name)
    return false;
  const normalizedName = name.trim().toLowerCase();
  return ['student', 'นักศึกษา', 'นิสิต'].some(keyword => normalizedName === keyword || normalizedName.includes(keyword));
}

export async function addUserRole(userId: string, roleId: number, facultyId?: number | null, departmentId?: number | null) {
  const [selectedRole] = await db.select({
    id: roles.id,
    name: roles.name,
    nameTh: roles.nameTh,
  }).from(roles).where(eq(roles.id, roleId));

  if (!selectedRole) {
    throw createError({ statusCode: 400, message: `Invalid roleId: ${roleId}` });
  }

  const existingRoles = await db.select({
    id: roles.id,
    name: roles.name,
    nameTh: roles.nameTh,
  })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  const hasExistingStudentRole = existingRoles.some(role => isStudentRoleName(role.name) || isStudentRoleName(role.nameTh));
  const selectedIsStudent = isStudentRoleName(selectedRole.name) || isStudentRoleName(selectedRole.nameTh);

  if (selectedIsStudent && existingRoles.length > 0) {
    throw createError({
      statusCode: 400,
      message: 'Student role must be assigned alone and cannot be combined with other roles',
    });
  }

  if (!selectedIsStudent && hasExistingStudentRole) {
    throw createError({
      statusCode: 400,
      message: 'Student role must be assigned alone and cannot be combined with other roles',
    });
  }

  return db.insert(userRoles).values({
    roleId,
    userId,
    facultyId,
    departmentId,
  });
}

export async function removeUserRole(userId: string, roleId: number) {
  const [selectedRole] = await db.select({
    name: roles.name,
  }).from(roles).where(eq(roles.id, roleId));

  if (!selectedRole) {
    throw createError({ statusCode: 400, message: `Invalid roleId: ${roleId}` });
  }

  const isAdminRole = selectedRole.name?.trim().toLowerCase() === 'admin';
  if (isAdminRole) {
    const [adminCountResult] = await db
      .select({ count: sql<number>`cast(count(distinct ${userRoles.userId}) as int)` })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(sql`lower(${roles.name}) = 'admin'`);

    if ((adminCountResult?.count ?? 0) <= 1) {
      throw createError({
        statusCode: 409,
        message: 'Cannot remove admin role from the last admin user',
        data: {
          code: 'LAST_ADMIN_ROLE_LOCKED',
        },
      });
    }
  }

  return db.delete(userRoles).where(
    and(
      eq(userRoles.userId, userId),
      eq(userRoles.roleId, roleId),
    ),
  );
}
