import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import { and, desc, ilike, or, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'faculty.view');

  const query = getQuery(event);
  const pageSize = Math.min(300, Math.max(1, Number(query.pageSize) || 200));
  const search = typeof query.search === 'string' ? query.search.trim() : '';

  const keyword = search ? `%${search}%` : null;

  const rows = await db
    .select({
      id: users.id,
      fullNameEn: sql<string>`concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})`,
      fullNameTh: sql<string>`concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`,
      email: users.email,
    })
    .from(users)
    .where(keyword
      ? and(
          or(
            ilike(users.email, keyword),
            ilike(users.staffId, keyword),
            ilike(users.studentId, keyword),
            ilike(sql<string>`concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})`, keyword),
            ilike(sql<string>`concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`, keyword),
          ),
        )
      : undefined)
    .orderBy(desc(users.updatedAt))
    .limit(pageSize);

  return { rows };
});
