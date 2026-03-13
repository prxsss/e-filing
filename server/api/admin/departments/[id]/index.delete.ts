import { deleteDepartmentById, getDepartmentById, getDepartmentDependencyCounts } from '~~/lib/db/queries/department';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'department.delete');

  const idParam = getRouterParam(event, 'id');
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid department id' });
  }

  const existingDepartment = await getDepartmentById(id);
  if (!existingDepartment) {
    throw createError({ statusCode: 404, message: `Department with ID ${id} not found` });
  }

  const { linkedUserCount } = await getDepartmentDependencyCounts(id);

  if (linkedUserCount > 0) {
    throw createError({
      statusCode: 409,
      message: 'Cannot delete this department because it still has users linked to it.',
    });
  }

  const deletedDepartment = await deleteDepartmentById(id);

  if (!deletedDepartment) {
    throw createError({ statusCode: 500, message: 'Failed to delete department' });
  }

  return {
    success: true,
    message: 'Department deleted successfully',
  };
});
