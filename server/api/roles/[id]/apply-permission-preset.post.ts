import {
  assertAdminCriticalPermissionsUnchanged,
  hasExactlyOneDashboardPermission,
  updateRolePermissions,
} from '~~/lib/db/queries/permission';
import { getPermissionPresetById } from '~~/lib/db/queries/permission-preset';
import { getRoleById } from '~~/lib/db/queries/role';
import * as zod from 'zod';

const applyPermissionPresetSchema = zod.object({
  presetId: zod.number(),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'role.assign_permission', 'permission_preset.apply');

  const id = Number(getRouterParam(event, 'id'));
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role ID' });
  }

  const body = await readValidatedBody(event, applyPermissionPresetSchema.parse);

  const [role, preset] = await Promise.all([
    getRoleById(id),
    getPermissionPresetById(body.presetId),
  ]);

  if (!role) {
    throw createError({ statusCode: 404, statusMessage: 'Role not found' });
  }

  if (!preset) {
    throw createError({ statusCode: 404, statusMessage: 'Permission preset not found' });
  }

  const hasExactlyOneDashboard = await hasExactlyOneDashboardPermission(preset.permissionIds);
  if (!hasExactlyOneDashboard) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Preset must include exactly one dashboard permission',
      data: { code: 'INVALID_DASHBOARD_PERMISSION_COUNT' },
    });
  }

  await assertAdminCriticalPermissionsUnchanged(id, preset.permissionIds);
  await updateRolePermissions(id, preset.permissionIds);

  return { success: true };
});
