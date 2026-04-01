import type { SQL } from 'drizzle-orm';

import db from '~~/lib/db';
import { request, userRoles, users } from '~~/lib/db/schema';
import { resolveDashboardRange } from '~~/server/utils/dashboard-period';
import { USER_STATUS } from '~~/shared/types/user-status';
import { and, count, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';

function parseFacultyId(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    return undefined;
  return parsed;
}

function formatHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0)
    return '0h';

  if (hours < 24)
    return `${hours.toFixed(1)}h`;

  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const period = typeof query.period === 'string' ? query.period : 'Last 30 days';
  const facultyId = parseFacultyId(query.facultyId);
  const customStartDate = typeof query.startDate === 'string' ? query.startDate : undefined;
  const customEndDate = typeof query.endDate === 'string' ? query.endDate : undefined;

  const { startDate, endDate } = resolveDashboardRange(period, customStartDate, customEndDate);

  const requestConditions: SQL[] = [
    gte(request.createdAt, startDate),
    lte(request.createdAt, endDate),
  ];

  if (facultyId) {
    requestConditions.push(sql`
      EXISTS (
        SELECT 1
        FROM ${userRoles} ur
        WHERE ur.user_id = ${request.userId}
        AND ur.faculty_id = ${facultyId}
      )
    `);
  }

  const whereClause = and(...requestConditions);

  const [summary] = await db
    .select({
      totalRequests: count(),
      completedRequests: count(sql`CASE WHEN ${request.status} = 'completed' THEN 1 END`),
      rejectedRequests: count(sql`CASE WHEN ${request.status} = 'rejected' THEN 1 END`),
    })
    .from(request)
    .where(whereClause);

  const medianConditions: SQL[] = [
    eq(request.status, 'completed'),
    isNotNull(request.submittedAt),
    isNotNull(request.completedAt),
    gte(request.createdAt, startDate),
    lte(request.createdAt, endDate),
  ];

  if (facultyId) {
    medianConditions.push(sql`
      EXISTS (
        SELECT 1
        FROM ${userRoles} ur
        WHERE ur.user_id = ${request.userId}
        AND ur.faculty_id = ${facultyId}
      )
    `);
  }

  const [medianRow] = await db
    .select({
      medianHours: sql<number>`
        COALESCE(
          PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (${request.completedAt} - ${request.submittedAt})) / 3600
          ),
          0
        )::float
      `,
    })
    .from(request)
    .where(and(...medianConditions));

  const activeUserConditions: SQL[] = [
    eq(users.status, USER_STATUS.ACTIVE),
    isNull(users.deletedAt),
  ];

  if (facultyId) {
    activeUserConditions.push(sql`
      EXISTS (
        SELECT 1
        FROM ${userRoles} ur
        WHERE ur.user_id = ${users.id}
        AND ur.faculty_id = ${facultyId}
      )
    `);
  }

  const [activeUserRow] = await db
    .select({
      activeUsers: count(),
    })
    .from(users)
    .where(and(...activeUserConditions));

  const totalRequests = summary?.totalRequests ?? 0;
  const completedRequests = summary?.completedRequests ?? 0;
  const rejectedRequests = summary?.rejectedRequests ?? 0;
  const completionRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;
  const medianHours = Number(medianRow?.medianHours ?? 0);

  return {
    success: true,
    data: {
      period,
      startDate,
      endDate,
      totalRequests,
      completedRequests,
      completionRate,
      rejectedRequests,
      activeUsers: activeUserRow?.activeUsers ?? 0,
      medianTurnaroundHours: medianHours,
      medianTurnaroundLabel: formatHours(medianHours),
    },
  };
});
