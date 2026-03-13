import { getFacultyById } from '~~/lib/db/queries/faculty';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'faculty.read');

  const idParam = getRouterParam(event, 'id');
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid faculty id' });
  }

  const faculty = await getFacultyById(id);

  if (!faculty) {
    throw createError({ statusCode: 404, message: `Faculty with ID ${id} not found` });
  }

  return faculty;
});
