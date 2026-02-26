import { getRoles } from '~~/lib/db/queries/role';

export default defineEventHandler(async () => {
  return await getRoles();
});
