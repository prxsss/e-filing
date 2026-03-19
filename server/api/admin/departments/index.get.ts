import { getDepartments } from '~~/lib/db/queries/department';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'department.view');

  const query = getQuery(event);

  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
  const offset = (page - 1) * pageSize;
  const search = typeof query.search === 'string' ? query.search : undefined;
  const parsedFacultyId = Number(query.facultyId);
  const facultyId = Number.isInteger(parsedFacultyId) && parsedFacultyId > 0 ? parsedFacultyId : undefined;

  const { rows, total } = await getDepartments({
    pageSize,
    offset,
    filters: {
      search,
      facultyId,
    },
  });

  return { rows, total, page, pageSize };
});
