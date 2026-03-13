import { deleteFacultyById, getFacultyById, getFacultyDependencyCounts } from '~~/lib/db/queries/faculty';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'faculty.delete');

  const idParam = getRouterParam(event, 'id');
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid faculty id' });
  }

  const existingFaculty = await getFacultyById(id);
  if (!existingFaculty) {
    throw createError({ statusCode: 404, message: `Faculty with ID ${id} not found` });
  }

  const { departmentCount, roleAssignmentCount } = await getFacultyDependencyCounts(id);

  if (departmentCount > 0) {
    throw createError({
      statusCode: 409,
      message: 'Cannot delete this faculty because it still has departments linked to it.',
    });
  }

  if (roleAssignmentCount > 0) {
    throw createError({
      statusCode: 409,
      message: 'Cannot delete this faculty because it is still used in role assignments.',
    });
  }

  const deletedFaculty = await deleteFacultyById(id);

  if (!deletedFaculty) {
    throw createError({ statusCode: 500, message: 'Failed to delete faculty' });
  }

  return {
    success: true,
    message: 'Faculty deleted successfully',
  };
});
