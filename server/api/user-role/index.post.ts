import { addUserRole } from '~~/lib/db/queries/user-role';

export default defineEventHandler(async (event) => {
  const { userId, roleId } = await readBody(event);

  await addUserRole(userId, roleId);
});
