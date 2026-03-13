import { addUserRole } from '~~/lib/db/queries/user-role';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.edit');

  const { userId, roleId, facultyId, departmentId } = await readBody(event);

  await addUserRole(userId, roleId, facultyId, departmentId);
});
