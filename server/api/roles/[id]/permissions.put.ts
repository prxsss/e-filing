import {
  assertAdminCriticalPermissionsUnchanged,
  getMissingPermissionIds,
  getRoleById,
  hasExactlyOneDashboardPermission,
  updateRolePermissions,
} from '~~/lib/db/queries/permission';

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

  const uniquePermissionIds = [...new Set(body.permissionIds)];
  if (uniquePermissionIds.length !== body.permissionIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'permissionIds must not contain duplicates',
      data: { code: 'DUPLICATE_PERMISSION_IDS' },
    });
  }

  const missingPermissionIds = await getMissingPermissionIds(uniquePermissionIds);
  if (missingPermissionIds.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'One or more permissions do not exist',
      data: { code: 'INVALID_PERMISSION_IDS', permissionIds: missingPermissionIds },
    });
  }

  const hasExactlyOneDashboard = await hasExactlyOneDashboardPermission(uniquePermissionIds);
  if (!hasExactlyOneDashboard) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Role must include exactly one dashboard permission',
      data: { code: 'INVALID_DASHBOARD_PERMISSION_COUNT' },
    });
  }

  const role = await getRoleById(id);
  if (!role) {
    throw createError({ statusCode: 404, statusMessage: 'Role not found' });
  }

  await assertAdminCriticalPermissionsUnchanged(id, uniquePermissionIds);

  await updateRolePermissions(id, uniquePermissionIds);

  return { success: true };
});
