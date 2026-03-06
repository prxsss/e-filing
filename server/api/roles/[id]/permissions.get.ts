import { getRolePermissionIds } from '~~/lib/db/queries/permission';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));

  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role ID' });
  }

  return await getRolePermissionIds(id);
});
