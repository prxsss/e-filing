import type { SQL } from 'drizzle-orm';

import db from '~~/lib/db';
import { request } from '~~/lib/db/schema';
import { resolveDashboardRange } from '~~/server/utils/dashboard-period';
import { and, gte, lte, sql } from 'drizzle-orm';

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

  const { startDate, endDate, bucket } = resolveDashboardRange(period, customStartDate, customEndDate);

  const conditions: SQL[] = [
    gte(request.createdAt, startDate),
    lte(request.createdAt, endDate),
  ];

  if (facultyId) {
    conditions.push(sql`
      EXISTS (
        SELECT 1
        FROM user_roles ur
        WHERE ur.user_id = ${request.userId}
        AND ur.faculty_id = ${facultyId}
      )
    `);
  }

  const bucketExpression = bucket === 'day'
    ? sql`date_trunc('day', ${request.createdAt})`
    : bucket === 'week'
      ? sql`date_trunc('week', ${request.createdAt})`
      : sql`date_trunc('month', ${request.createdAt})`;

  const rows = await db
    .select({
      bucket: sql<string>`${bucketExpression}::text`,
      submissions: sql<number>`COUNT(*)::int`,
      completions: sql<number>`COUNT(CASE WHEN ${request.status} = 'completed' THEN 1 END)::int`,
    })
    .from(request)
    .where(and(...conditions))
    .groupBy(bucketExpression)
    .orderBy(bucketExpression);

  return {
    success: true,
    data: rows,
    meta: {
      period,
      startDate,
      endDate,
      bucket,
    },
  };
});
