import { getPermissions } from '~~/lib/db/queries/permission';

export default defineEventHandler(async () => {
  return await getPermissions();
});
