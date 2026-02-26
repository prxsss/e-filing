import { getUserById } from '~~/lib/db/queries/user';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const user = await getUserById(id ?? '');
  return user;
});
