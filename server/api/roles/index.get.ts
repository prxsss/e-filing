import { getRoles } from '~~/lib/db/queries/role';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'role.view');

  return await getRoles();
});
