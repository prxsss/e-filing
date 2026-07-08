import { getPermissionPresets } from '~~/lib/db/queries/permission-preset';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'permission_preset.view');

  return await getPermissionPresets();
});
