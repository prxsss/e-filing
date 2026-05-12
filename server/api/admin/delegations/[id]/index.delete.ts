import { deleteDelegation, getDelegationById } from '~~/lib/db/queries/dean-delegation';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'faculty.edit');

  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid delegation id' });
  }

  const existing = await getDelegationById(id);
  if (!existing) {
    throw createError({ statusCode: 404, message: `Delegation with ID ${id} not found` });
  }

  await deleteDelegation(id);
  return { success: true };
});
