import {
  getMissingPermissionIds,
  hasExactlyOneDashboardPermission,
} from '~~/lib/db/queries/permission';

export async function validatePermissionIdsForPreset(permissionIds: number[]) {
  const uniquePermissionIds = [...new Set(permissionIds)];

  if (uniquePermissionIds.length !== permissionIds.length) {
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
      statusMessage: 'Preset must include exactly one dashboard permission',
      data: { code: 'INVALID_DASHBOARD_PERMISSION_COUNT' },
    });
  }

  return uniquePermissionIds;
}
