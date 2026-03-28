import { eq, sql } from 'drizzle-orm';

import db from '..';
import { permissions, rolePermissions, roles, userRoles } from '../schema';

type RoleListFilters = {
  permission?: string;
};

export async function getRoles(filters: RoleListFilters = {}) {
  const { permission } = filters;

  const rolesListQuery = db
    .select({
      id: roles.id,
      name: roles.name,
      nameTh: roles.nameTh,
      descriptionEn: roles.descriptionEn,
      descriptionTh: roles.descriptionTh,
      userCount: sql<number>`cast(count(${userRoles.userId}) as int)`,
    })
    .from(roles)
    .leftJoin(userRoles, sql`${roles.id} = ${userRoles.roleId}`)
    .groupBy(roles.id)
    .orderBy(roles.id);

  // Join permissions if filtering by permission
  if (permission) {
    rolesListQuery.leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(permissions.code, permission));
  }

  return rolesListQuery;
}

export async function getRoleWithUserCount(id: number) {
  const [role] = await db
    .select({
      id: roles.id,
      name: roles.name,
      userCount: sql<number>`cast(count(${userRoles.userId}) as int)`,
    })
    .from(roles)
    .leftJoin(userRoles, sql`${roles.id} = ${userRoles.roleId}`)
    .where(eq(roles.id, id))
    .groupBy(roles.id);

  return role ?? null;
}

export async function createRole(data: {
  name: string;
  nameTh: string;
  descriptionEn?: string | null;
  descriptionTh?: string | null;
  permissionIds?: number[];
}) {
  return db.transaction(async (tx) => {
    const [role] = await tx
      .insert(roles)
      .values({
        name: data.name,
        nameTh: data.nameTh,
        descriptionEn: data.descriptionEn ?? null,
        descriptionTh: data.descriptionTh ?? null,
      })
      .returning();

    if (data.permissionIds && data.permissionIds.length > 0) {
      await tx.insert(rolePermissions).values(
        data.permissionIds.map(permissionId => ({
          roleId: role!.id,
          permissionId,
        })),
      );
    }

    return role;
  });
}

export async function updateRole(
  id: number,
  data: {
    name?: string;
    nameTh?: string;
    descriptionEn?: string | null;
    descriptionTh?: string | null;
  },
) {
  const [updated] = await db
    .update(roles)
    .set(data)
    .where(eq(roles.id, id))
    .returning();

  return updated;
}

export async function getRoleById(id: number) {
  const [role] = await db
    .select({
      id: roles.id,
      name: roles.name,
      nameTh: roles.nameTh,
      descriptionEn: roles.descriptionEn,
      descriptionTh: roles.descriptionTh,
    })
    .from(roles)
    .where(eq(roles.id, id));

  return role ?? null;
}

export async function deleteRole(id: number) {
  return db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    await tx.delete(userRoles).where(eq(userRoles.roleId, id));
    const [deleted] = await tx.delete(roles).where(eq(roles.id, id)).returning();
    return deleted;
  });
}
