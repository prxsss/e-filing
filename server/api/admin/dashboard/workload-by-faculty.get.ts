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
  const data = await db
    .select({
      facultyId: faculties.id,
      facultyNameEn: faculties.nameEn,
      facultyNameTh: faculties.nameTh,
      total: sql<number>`COUNT(DISTINCT ${request.id})::int`,
      completed: sql<number>`COUNT(DISTINCT CASE WHEN ${request.status} = 'completed' THEN ${request.id} END)::int`,
      pending: sql<number>`COUNT(DISTINCT CASE WHEN ${request.status} IN ('submitted', 'in_progress', 'pending') THEN ${request.id} END)::int`,
      rejected: sql<number>`COUNT(DISTINCT CASE WHEN ${request.status} = 'rejected' THEN ${request.id} END)::int`,
    })
    .from(faculties)
    .leftJoin(
      request,
      and(
        eq(request.facultyId, faculties.id),
        gte(request.createdAt, startDate),
        lte(request.createdAt, endDate),
      ),
    )
    .where(facultyWhere)
    .groupBy(faculties.id)
    .orderBy(asc(faculties.nameEn));

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
