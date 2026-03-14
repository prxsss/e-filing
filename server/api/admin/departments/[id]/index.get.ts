import { getDepartmentById } from '~~/lib/db/queries/department';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'department.view');

  const idParam = getRouterParam(event, 'id');
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid department id' });
  }

  const department = await getDepartmentById(id);

  if (!department) {
    throw createError({ statusCode: 404, message: `Department with ID ${id} not found` });
  }

  return department;
});
