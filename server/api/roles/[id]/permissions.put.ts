import { updateRolePermissions } from '~~/lib/db/queries/permission';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'role.assign_permission');

  const id = Number(getRouterParam(event, 'id'));

  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role ID' });
  }

  const body = await readBody<{ permissionIds: number[] }>(event);

  if (!Array.isArray(body.permissionIds)) {
    throw createError({ statusCode: 400, statusMessage: 'permissionIds must be an array' });
  }

  await updateRolePermissions(id, body.permissionIds);

  return { success: true };
});
