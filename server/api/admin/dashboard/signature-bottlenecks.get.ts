import type { SQL } from 'drizzle-orm';

import db from '~~/lib/db';
import { request, signatureFlow } from '~~/lib/db/schema';
import { resolveDashboardRange } from '~~/server/utils/dashboard-period';
import { and, gte, lte, ne, sql } from 'drizzle-orm';

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
    gte(signatureFlow.createdAt, startDate),
    lte(signatureFlow.createdAt, endDate),

    // role id 1 is the requester (student)
    // Since we're analyzing bottlenecks in the signing process,
    // we want to exclude the requester role from this analysis
    ne(signatureFlow.roleId, 1),
  ];

  if (facultyId) {
    conditions.push(sql`
      EXISTS (
        SELECT 1
        FROM ${request} r
        WHERE r.id = ${signatureFlow.requestId}
        AND EXISTS (
          SELECT 1
          FROM user_roles ur
          WHERE ur.user_id = r.user_id
          AND ur.faculty_id = ${facultyId}
        )
      )
    `);
  }

  const avgWaitingHoursExpression = sql<number>`
    COALESCE(
      AVG(
        CASE
          WHEN ${signatureFlow.status} = 'pending'
            AND ${signatureFlow.pendingAt} IS NOT NULL
          THEN EXTRACT(EPOCH FROM (NOW() - ${signatureFlow.pendingAt})) / 3600

          WHEN ${signatureFlow.status} = 'signed'
            AND ${signatureFlow.pendingAt} IS NOT NULL
            AND ${signatureFlow.signedAt} IS NOT NULL
          THEN EXTRACT(EPOCH FROM (${signatureFlow.signedAt} - ${signatureFlow.pendingAt})) / 3600
        END
      ),
      0
    )::float
  `;

  const baseQuery = db
    .select({
      roleName: signatureFlow.roleName,
      pendingCount: sql<number>`COUNT(CASE WHEN ${signatureFlow.status} = 'pending' THEN 1 END)::int`,
      avgWaitingHours: avgWaitingHoursExpression,
    })
    .from(signatureFlow)
    .where(and(...conditions))
    .groupBy(signatureFlow.roleName)
    .orderBy(sql`${avgWaitingHoursExpression} DESC`);

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
