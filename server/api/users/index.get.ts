import { getUsers } from '~~/lib/db/queries/user';

export default defineEventHandler(async () => {
  return await getUsers();
});
