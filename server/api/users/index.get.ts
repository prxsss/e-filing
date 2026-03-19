import { getUsers } from '~~/lib/db/queries/user';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.view');

  const query = getQuery(event);

  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
  const offset = (page - 1) * pageSize;

  const search = typeof query.search === 'string' ? query.search : undefined;
  const facultyId = query.facultyId !== undefined ? Number(query.facultyId) : undefined;
  const departmentId = query.departmentId !== undefined ? Number(query.departmentId) : undefined;
  const roleId = query.roleId !== undefined ? Number(query.roleId) : undefined;
  const status = query.status === 'active' || query.status === 'banned' ? query.status : undefined;

  const { rows, total } = await getUsers({
    pageSize,
    offset,
    filters: {
      search,
      facultyId: Number.isNaN(facultyId) ? undefined : facultyId,
      departmentId: Number.isNaN(departmentId) ? undefined : departmentId,
      roleId: Number.isNaN(roleId) ? undefined : roleId,
      status,
    },
  });

  return { rows, total, page, pageSize };
});
