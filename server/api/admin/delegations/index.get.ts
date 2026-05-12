import { getDelegations } from '~~/lib/db/queries/dean-delegation';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'faculty.view');

  const query = getQuery(event);
  const facultyId = query.facultyId ? Number(query.facultyId) : undefined;

  const rows = await getDelegations({ facultyId });
  return { rows };
});
