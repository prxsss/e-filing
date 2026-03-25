import type { SQL } from 'drizzle-orm';

import db from '~~/lib/db';
import { request, requestTemplate } from '~~/lib/db/schema';
import { resolveDashboardRange } from '~~/server/utils/dashboard-period';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

function parseFacultyId(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    return undefined;
  return parsed;
}

function parseTopLimit(value: unknown, fallback = 5): number | undefined {
  if (value === 'all')
    return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    return fallback;

  if (parsed > 10)
    return 10;

  return parsed;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const period = typeof query.period === 'string' ? query.period : 'Last 30 days';
  const facultyId = parseFacultyId(query.facultyId);
  const limit = parseTopLimit(query.limit);
  const customStartDate = typeof query.startDate === 'string' ? query.startDate : undefined;
  const customEndDate = typeof query.endDate === 'string' ? query.endDate : undefined;
  const { startDate, endDate } = resolveDashboardRange(period, customStartDate, customEndDate);

  const conditions: SQL[] = [
    eq(requestTemplate.isActive, true),
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

  const baseQuery = db
    .select({
      templateId: requestTemplate.id,
      templateName: requestTemplate.name,
      usage: sql<number>`COUNT(${request.id})::int`,
      completionRate: sql<number>`
        COALESCE(
          COUNT(CASE WHEN ${request.status} = 'completed' THEN 1 END)::float
          / NULLIF(COUNT(${request.id}), 0),
          0
        )
      `,
    })
    .from(request)
    .innerJoin(requestTemplate, eq(request.templateId, requestTemplate.id))
    .where(and(...conditions))
    .groupBy(requestTemplate.id)
    .orderBy(desc(sql`COUNT(${request.id})`), desc(requestTemplate.createdAt));

  const rows = typeof limit === 'number'
    ? await baseQuery.limit(limit)
    : await baseQuery;

  return {
    success: true,
    data: rows,
    meta: {
      period,
      startDate,
      endDate,
    },
  };
});
