import { getRoles } from '~~/lib/db/queries/role';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'role.view');

  const query = getQuery(event);
  const permission = typeof query.permission === 'string' ? query.permission : undefined;

  return await getRoles({ permission });
});
