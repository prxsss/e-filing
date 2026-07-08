import { deletePermissionPreset } from '~~/lib/db/queries/permission-preset';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'permission_preset.delete');

  const id = Number(getRouterParam(event, 'id'));
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid permission preset ID' });
  }

  const deleted = await deletePermissionPreset(id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Permission preset not found' });
  }

  return { success: true };
});
