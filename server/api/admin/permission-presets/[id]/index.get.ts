import { getPermissionPresetById } from '~~/lib/db/queries/permission-preset';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'permission_preset.view');

  const id = Number(getRouterParam(event, 'id'));
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid permission preset ID' });
  }

  const preset = await getPermissionPresetById(id);
  if (!preset) {
    throw createError({ statusCode: 404, statusMessage: 'Permission preset not found' });
  }

  return preset;
});
