import { isDuplicatePermissionPresetNameError, updatePermissionPreset } from '~~/lib/db/queries/permission-preset';
import * as zod from 'zod';

const updatePermissionPresetSchema = zod.object({
  name: zod.string().min(1, 'Preset name (EN) is required'),
  nameTh: zod.string().min(1, 'Preset name (TH) is required'),
  descriptionEn: zod.string().optional(),
  descriptionTh: zod.string().optional(),
  permissionIds: zod.array(zod.number()),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'permission_preset.edit');

  const id = Number(getRouterParam(event, 'id'));
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid permission preset ID' });
  }

  const body = await readValidatedBody(event, updatePermissionPresetSchema.parse);
  const permissionIds = await validatePermissionIdsForPreset(body.permissionIds);

  try {
    const preset = await updatePermissionPreset(id, {
      name: body.name.trim(),
      nameTh: body.nameTh.trim(),
      descriptionEn: body.descriptionEn,
      descriptionTh: body.descriptionTh,
      permissionIds,
    });

    if (!preset) {
      throw createError({ statusCode: 404, statusMessage: 'Permission preset not found' });
    }

    return { success: true, preset };
  }
  catch (error: unknown) {
    if (isDuplicatePermissionPresetNameError(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A permission preset with this name already exists',
        data: { code: 'PERMISSION_PRESET_NAME_ALREADY_EXISTS' },
      });
    }

    throw error;
  }
});
