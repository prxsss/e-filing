import { getUsersByRoleId } from '~~/lib/db/queries/user-by-role';

export default defineEventHandler(async (event) => {
  const roleId = Number(getRouterParam(event, 'role-id'));
  if (!roleId || Number.isNaN(roleId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid roleId' });
  }
  return await getUsersByRoleId(roleId);
});
