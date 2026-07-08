import { createPermissionPreset, isDuplicatePermissionPresetNameError } from '~~/lib/db/queries/permission-preset';
import * as zod from 'zod';

const createPermissionPresetSchema = zod.object({
  name: zod.string().min(1, 'Preset name (EN) is required'),
  nameTh: zod.string().min(1, 'Preset name (TH) is required'),
  descriptionEn: zod.string().optional(),
  descriptionTh: zod.string().optional(),
  permissionIds: zod.array(zod.number()),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'permission_preset.create');

  const body = await readValidatedBody(event, createPermissionPresetSchema.parse);
  const permissionIds = await validatePermissionIdsForPreset(body.permissionIds);

  try {
    const preset = await createPermissionPreset({
      name: body.name.trim(),
      nameTh: body.nameTh.trim(),
      descriptionEn: body.descriptionEn,
      descriptionTh: body.descriptionTh,
      permissionIds,
    });

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
