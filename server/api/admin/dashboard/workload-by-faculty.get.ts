import type { SQL } from 'drizzle-orm';

import db from '~~/lib/db';
import { faculties, request } from '~~/lib/db/schema';
import { resolveDashboardRange } from '~~/server/utils/dashboard-period';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';

function parseFacultyId(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    return undefined;
  return parsed;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const period = typeof query.period === 'string' ? query.period : 'Last 30 days';
  const facultyId = parseFacultyId(query.facultyId);
  const customStartDate = typeof query.startDate === 'string' ? query.startDate : undefined;
  const customEndDate = typeof query.endDate === 'string' ? query.endDate : undefined;
  const { startDate, endDate } = resolveDashboardRange(period, customStartDate, customEndDate);

  const facultyWhere = facultyId ? eq(faculties.id, facultyId) : undefined;
  const facultyRows = await db
    .select({
      id: faculties.id,
      nameEn: faculties.nameEn,
      nameTh: faculties.nameTh,
    })
    .from(faculties)
    .where(facultyWhere)
    .orderBy(asc(faculties.nameEn));

  const data = await Promise.all(
    facultyRows.map(async (faculty) => {
      const conditions: SQL[] = [
        gte(request.createdAt, startDate),
        lte(request.createdAt, endDate),
        sql`
          EXISTS (
            SELECT 1
            FROM user_roles ur
            WHERE ur.user_id = ${request.userId}
            AND ur.faculty_id = ${faculty.id}
          )
        `,
      ];

      const [counts] = await db
        .select({
          total: sql<number>`COUNT(*)::int`,
          completed: sql<number>`COUNT(CASE WHEN ${request.status} = 'completed' THEN 1 END)::int`,
          inProgress: sql<number>`COUNT(CASE WHEN ${request.status} IN ('submitted', 'in_progress', 'pending') THEN 1 END)::int`,
          rejected: sql<number>`COUNT(CASE WHEN ${request.status} = 'rejected' THEN 1 END)::int`,
        })
        .from(request)
        .where(and(...conditions));

      return {
        facultyId: faculty.id,
        facultyNameEn: faculty.nameEn,
        facultyNameTh: faculty.nameTh,
        total: counts?.total ?? 0,
        completed: counts?.completed ?? 0,
        pending: counts?.inProgress ?? 0,
        rejected: counts?.rejected ?? 0,
      };
    }),
  );

  return {
    success: true,
    data,
    meta: {
      period,
      startDate,
      endDate,
    },
  };
});
