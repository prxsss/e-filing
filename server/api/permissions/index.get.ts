import { getPermissions } from '~~/lib/db/queries/permission';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'permission.view');

  return await getPermissions();
});
