import { getFaculties } from '~~/lib/db/queries/faculty';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'faculty.read');

  return await getFaculties();
});
