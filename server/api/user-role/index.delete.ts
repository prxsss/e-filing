import { removeUserRole } from '~~/lib/db/queries/user-role';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.edit');

  const { userId, roleId } = await readBody(event);

  await removeUserRole(userId, roleId);

  return { success: true };
});
