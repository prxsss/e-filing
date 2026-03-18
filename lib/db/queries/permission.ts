import { and, eq, sql } from 'drizzle-orm';

import db from '..';
import { permissions, rolePermissions, roles } from '../schema';

export async function getPermissions() {
  return db.select().from(permissions);
}

export async function getRolePermissionIds(roleId: number) {
  const result = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));

  return result.map(r => r.permissionId);
}

export async function getRoleById(roleId: number) {
  const [role] = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(eq(roles.id, roleId));

  return role ?? null;
}

export async function getRoleScopedPermissionIds() {
  const result = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(sql`${permissions.code} like 'role.%' or ${permissions.code} like 'permission.%'`);

  return new Set(result.map(r => r.id));
}

export async function getAssignedRoleScopedPermissionIds(roleId: number) {
  const result = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(rolePermissions.roleId, roleId),
        sql`${permissions.code} like 'role.%' or ${permissions.code} like 'permission.%'`,
      ),
    );

  return new Set(result.map(r => r.permissionId));
}

export async function updateRolePermissions(roleId: number, permissionIds: number[]) {
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    if (permissionIds.length > 0) {
      await tx.insert(rolePermissions).values(
        permissionIds.map(permissionId => ({ roleId, permissionId })),
      );
    }
  });
}
