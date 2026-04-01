import db from '~~/lib/db';
import { permissions, rolePermissions, roles, userRoles, users } from '~~/lib/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import * as zod from 'zod';

const updateProfileSchema = zod.object({
  titleEn: zod.string().max(20).optional().nullable(),
  firstNameEn: zod.string().trim().min(1, 'First name (EN) is required'),
  lastNameEn: zod.string().trim().min(1, 'Last name (EN) is required'),
  titleTh: zod.string().max(20).optional().nullable(),
  firstNameTh: zod.string().trim().min(1, 'First name (TH) is required'),
  lastNameTh: zod.string().trim().min(1, 'Last name (TH) is required'),
  roleAssignments: zod.array(zod.object({
    roleId: zod.number().int().positive(),
    facultyId: zod.number().int().positive(),
    departmentId: zod.number().int().positive().nullable().optional(),
  })).min(1, 'At least one role assignment is required'),
});

export default defineEventHandler(async (event) => {
  // Disable Signer Profile API
  throw createError({
    statusCode: 404,
    message: 'Not Found',
  });

  await requirePermission(event, 'request.sign');

  const user = event.context.user!; // We can assert this because of the require-auth middleware

  const body = await readValidatedBody(event, updateProfileSchema.parse);
  const assignmentKeys = new Set<string>();

  for (const assignment of body.roleAssignments) {
    const key = `${assignment.roleId}|${assignment.facultyId ?? 'null'}|${assignment.departmentId ?? 'null'}`;
    if (assignmentKeys.has(key)) {
      throw createError({
        statusCode: 400,
        message: 'Duplicate role assignment is not allowed',
      });
    }
    assignmentKeys.add(key);
  }

  const uniqueRoleIds = [...new Set(body.roleAssignments.map(item => item.roleId))];

  const selectedRoles = await db
    .select({ id: roles.id })
    .from(roles)
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(
      inArray(roles.id, uniqueRoleIds),
      eq(permissions.code, 'request.sign'),
    ));

  if (selectedRoles.length !== uniqueRoleIds.length) {
    throw createError({
      statusCode: 400,
      message: 'Some selected roles are invalid for signing',
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        titleEn: body.titleEn?.trim() || null,
        firstNameEn: body.firstNameEn.trim(),
        lastNameEn: body.lastNameEn.trim(),
        titleTh: body.titleTh?.trim() || null,
        firstNameTh: body.firstNameTh.trim(),
        lastNameTh: body.lastNameTh.trim(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id));

    const existingSignRoleRows = await tx
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(
        eq(userRoles.userId, user.id),
        eq(permissions.code, 'request.sign'),
      ));

    const existingSignRoleIds = [...new Set(existingSignRoleRows.map(item => item.roleId))];

    if (existingSignRoleIds.length > 0) {
      await tx.delete(userRoles).where(and(
        eq(userRoles.userId, user.id),
        inArray(userRoles.roleId, existingSignRoleIds),
      ));
    }

    await tx.insert(userRoles).values(
      body.roleAssignments.map(item => ({
        userId: user.id,
        roleId: item.roleId,
        facultyId: item.facultyId ?? null,
        departmentId: item.departmentId ?? null,
      })),
    );
  });

  const [updatedUser] = await db
    .select({
      id: users.id,
      email: users.email,
      titleEn: users.titleEn,
      fullNameEn: sql<string>`concat_ws(' ', ${users.firstNameEn}, ${users.lastNameEn})`,
      titleTh: users.titleTh,
      fullNameTh: sql<string>`concat_ws(' ', ${users.firstNameTh}, ${users.lastNameTh})`,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!updatedUser) {
    throw createError({
      statusCode: 404,
      message: 'User profile not found after update',
    });
  }

  const assignedRoleRows = await db
    .select({
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id))
    .orderBy(userRoles.id);

  const [userPermissionData] = await db
    .select({
      permissions: sql<string[]>`array_agg(DISTINCT ${permissions.code})`,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, user.id));

  const mappedRoles = assignedRoleRows
    .map(item => item.roleName)
    .filter((role): role is string => Boolean(role));
  const mappedPermissions = (userPermissionData?.permissions ?? []).filter((permission): permission is string => Boolean(permission));

  await replaceUserSession(event, {
    user: {
      id: updatedUser.id,
      titleEn: updatedUser.titleEn || undefined,
      fullNameEn: updatedUser.fullNameEn,
      fullNameTh: updatedUser.fullNameTh,
      titleTh: updatedUser.titleTh || undefined,
      roles: mappedRoles,
      currentRole: mappedRoles[0] ?? '',
      permissions: mappedPermissions,
      typePerson: user.typePerson,
      campus: user.campus,
      email: updatedUser.email,
      idToken: user.idToken,
      authProvider: user.authProvider,
    },
    lastLoggedIn: new Date(),
  });

  return {
    success: true,
    user: {
      id: updatedUser.id,
      titleEn: updatedUser.titleEn || undefined,
      fullNameEn: updatedUser.fullNameEn,
      fullNameTh: updatedUser.fullNameTh,
      titleTh: updatedUser.titleTh || undefined,
      roles: mappedRoles,
      currentRole: mappedRoles[0] ?? '',
      permissions: mappedPermissions,
      email: updatedUser.email,
    },
  };
});
