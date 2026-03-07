import { eq } from 'drizzle-orm';

import db from '..';
import { permissions, rolePermissions } from '../schema';

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
