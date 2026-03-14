import { eq, sql } from 'drizzle-orm';

import db from '..';
import { rolePermissions, roles, userRoles } from '../schema';

export async function getRoles() {
  return db
    .select({
      id: roles.id,
      name: roles.name,
      descriptionEn: roles.descriptionEn,
      descriptionTh: roles.descriptionTh,
      userCount: sql<number>`cast(count(${userRoles.userId}) as int)`,
    })
    .from(roles)
    .leftJoin(userRoles, sql`${roles.id} = ${userRoles.roleId}`)
    .groupBy(roles.id);
}

export async function createRole(data: {
  name: string;
  descriptionEn?: string | null;
  descriptionTh?: string | null;
  permissionIds?: number[];
}) {
  return db.transaction(async (tx) => {
    const [role] = await tx
      .insert(roles)
      .values({
        name: data.name,
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

export async function deleteRole(id: number) {
  return db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    await tx.delete(userRoles).where(eq(userRoles.roleId, id));
    const [deleted] = await tx.delete(roles).where(eq(roles.id, id)).returning();
    return deleted;
  });
}
