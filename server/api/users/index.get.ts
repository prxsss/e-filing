import { getUsers } from '~~/lib/db/queries/user';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.view');

  return await getUsers();
});
