import {
  getAssignedRoleScopedPermissionIds,
  getRoleById,
  getRoleScopedPermissionIds,

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

  const hasExactlyOneDashboard = await hasExactlyOneDashboardPermission(body.permissionIds);
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

  // Protect Admin role from losing or changing any role.* / permission.* permissions.
  if (role.name.toLowerCase() === 'admin') {
    const [protectedPermissionIds, currentProtectedAssignments] = await Promise.all([
      getRoleScopedPermissionIds(),
      getAssignedRoleScopedPermissionIds(id),
    ]);

    const nextProtectedAssignments = new Set(
      body.permissionIds.filter(permissionId => protectedPermissionIds.has(permissionId)),
    );

    if (currentProtectedAssignments.size !== nextProtectedAssignments.size) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Admin role.* and permission.* permissions are locked',
        data: { code: 'ADMIN_CRITICAL_PERMISSIONS_LOCKED' },
      });
    }

    for (const permissionId of currentProtectedAssignments) {
      if (!nextProtectedAssignments.has(permissionId)) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Admin role.* and permission.* permissions are locked',
          data: { code: 'ADMIN_CRITICAL_PERMISSIONS_LOCKED' },
        });
      }
    }
  }

  await updateRolePermissions(id, body.permissionIds);

  return { success: true };
});
