import { deleteRole } from '~~/lib/db/queries/role';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'role.delete');

  const id = Number(getRouterParam(event, 'id'));
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role ID' });
  }

  const role = await deleteRole(id);
  if (!role) {
    throw createError({ statusCode: 404, statusMessage: 'Role not found' });
  }

  return { success: true };
});
