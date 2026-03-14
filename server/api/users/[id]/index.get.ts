import { getUserById } from '~~/lib/db/queries/user';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.view');

  const id = getRouterParam(event, 'id') as string;
  const user = await getUserById(id);
  return user;
});
