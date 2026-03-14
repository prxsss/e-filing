import { getFaculties } from '~~/lib/db/queries/faculty';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, 'faculty.read');

  const query = getQuery(event);

  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
  const offset = (page - 1) * pageSize;

  const { rows, total } = await getFaculties({ pageSize, offset });

  return { rows, total, page, pageSize };
});
