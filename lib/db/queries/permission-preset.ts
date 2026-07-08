import { eq, inArray, sql } from 'drizzle-orm';

import db from '..';
import { permissionPresetPermissions, permissionPresets } from '../schema';

export type PermissionPresetInput = {
  name: string;
  nameTh: string;
  descriptionEn?: string | null;
  descriptionTh?: string | null;
  permissionIds: number[];
};

export async function getPermissionPresets() {
  const rows = await db
    .select({
      id: permissionPresets.id,
      name: permissionPresets.name,
      nameTh: permissionPresets.nameTh,
      descriptionEn: permissionPresets.descriptionEn,
      descriptionTh: permissionPresets.descriptionTh,
      createdAt: permissionPresets.createdAt,
      updatedAt: permissionPresets.updatedAt,
      permissionId: permissionPresetPermissions.permissionId,
    })
    .from(permissionPresets)
    .leftJoin(permissionPresetPermissions, eq(permissionPresets.id, permissionPresetPermissions.presetId))
    .orderBy(permissionPresets.id);

  const presetMap = new Map<number, {
    id: number;
    name: string;
    nameTh: string;
    descriptionEn: string | null;
    descriptionTh: string | null;
    createdAt: string;
    updatedAt: string;
    permissionIds: number[];
  }>();

  for (const row of rows) {
    if (!presetMap.has(row.id)) {
      presetMap.set(row.id, {
        id: row.id,
        name: row.name,
        nameTh: row.nameTh,
        descriptionEn: row.descriptionEn,
        descriptionTh: row.descriptionTh,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        permissionIds: [],
      });
    }

    if (row.permissionId !== null) {
      presetMap.get(row.id)!.permissionIds.push(row.permissionId);
    }
  }

  return Array.from(presetMap.values());
}

export async function getPermissionPresetById(id: number) {
  const rows = await db
    .select({
      id: permissionPresets.id,
      name: permissionPresets.name,
      nameTh: permissionPresets.nameTh,
      descriptionEn: permissionPresets.descriptionEn,
      descriptionTh: permissionPresets.descriptionTh,
      createdAt: permissionPresets.createdAt,
      updatedAt: permissionPresets.updatedAt,
      permissionId: permissionPresetPermissions.permissionId,
    })
    .from(permissionPresets)
    .leftJoin(permissionPresetPermissions, eq(permissionPresets.id, permissionPresetPermissions.presetId))
    .where(eq(permissionPresets.id, id));

  const firstRow = rows[0];
  if (!firstRow) {
    return null;
  }

  return {
    id: firstRow.id,
    name: firstRow.name,
    nameTh: firstRow.nameTh,
    descriptionEn: firstRow.descriptionEn,
    descriptionTh: firstRow.descriptionTh,
    createdAt: firstRow.createdAt,
    updatedAt: firstRow.updatedAt,
    permissionIds: rows
      .map(row => row.permissionId)
      .filter((permissionId): permissionId is number => permissionId !== null),
  };
}

export async function createPermissionPreset(data: PermissionPresetInput) {
  return db.transaction(async (tx) => {
    const [preset] = await tx
      .insert(permissionPresets)
      .values({
        name: data.name,
        nameTh: data.nameTh,
        descriptionEn: data.descriptionEn ?? null,
        descriptionTh: data.descriptionTh ?? null,
      })
      .returning();

    if (data.permissionIds.length > 0) {
      await tx.insert(permissionPresetPermissions).values(
        data.permissionIds.map(permissionId => ({
          presetId: preset!.id,
          permissionId,
        })),
      );
    }

    return preset!;
  });
}

export async function updatePermissionPreset(id: number, data: PermissionPresetInput) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(permissionPresets)
      .set({
        name: data.name,
        nameTh: data.nameTh,
        descriptionEn: data.descriptionEn ?? null,
        descriptionTh: data.descriptionTh ?? null,
        updatedAt: sql`now()`,
      })
      .where(eq(permissionPresets.id, id))
      .returning();

    if (!updated) {
      return null;
    }

    await tx.delete(permissionPresetPermissions).where(eq(permissionPresetPermissions.presetId, id));

    if (data.permissionIds.length > 0) {
      await tx.insert(permissionPresetPermissions).values(
        data.permissionIds.map(permissionId => ({ presetId: id, permissionId })),
      );
    }

    return updated;
  });
}

export async function deletePermissionPreset(id: number) {
  const [deleted] = await db
    .delete(permissionPresets)
    .where(eq(permissionPresets.id, id))
    .returning();

  return deleted ?? null;
}

export async function getPermissionPresetPermissionIds(id: number) {
  const rows = await db
    .select({ permissionId: permissionPresetPermissions.permissionId })
    .from(permissionPresetPermissions)
    .where(eq(permissionPresetPermissions.presetId, id));

  return rows.map(row => row.permissionId);
}

export function isDuplicatePermissionPresetNameError(error: unknown) {
  const dbError = error as {
    code?: string;
    cause?: { code?: string; message?: string; constraint?: string };
    constraint?: string;
    message?: string;
  };

  const errorCode = dbError.code ?? dbError.cause?.code;
  const errorConstraint = dbError.constraint ?? dbError.cause?.constraint;
  const combinedMessage = `${dbError.message || ''} ${dbError.cause?.message || ''}`.toLowerCase();

  return errorCode === '23505'
    || errorConstraint === 'permission_presets_name_unique_ci'
    || errorConstraint === 'permission_presets_name_th_unique_ci'
    || combinedMessage.includes('permission_presets_name_unique_ci')
    || combinedMessage.includes('permission_presets_name_th_unique_ci');
}

export async function getPermissionPresetsByIds(ids: number[]) {
  if (ids.length === 0) {
    return [];
  }

  return db
    .select()
    .from(permissionPresets)
    .where(inArray(permissionPresets.id, ids));
}
