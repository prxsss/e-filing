import { deleteRole, getRoleWithUserCount } from '~~/lib/db/queries/role';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'role.delete');

  const id = Number(getRouterParam(event, 'id'));
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role ID' });
  }

  const role = await getRoleWithUserCount(id);
  if (!role) {
    throw createError({ statusCode: 404, statusMessage: 'Role not found' });
  }

  if (role.name.toLowerCase() === 'admin') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Admin role cannot be deleted',
      data: {
        code: 'ADMIN_ROLE_DELETE_LOCKED',
      },
    });
  }

  if (role.userCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Role is in use and cannot be deleted',
      data: {
        code: 'ROLE_IN_USE',
        userCount: role.userCount,
      },
    });
  }

  await deleteRole(id);

  return { success: true };
});
