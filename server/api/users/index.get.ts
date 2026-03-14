import { getUsers } from '~~/lib/db/queries/user';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.view');

  const query = getQuery(event);

  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
  const offset = (page - 1) * pageSize;

  const { rows, total } = await getUsers({ pageSize, offset });

  return { rows, total, page, pageSize };
});
