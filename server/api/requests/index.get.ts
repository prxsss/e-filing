import db from '~~/lib/db';
import { request, requestTemplate, users } from '~~/lib/db/schema';
import { and, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);
  try {
    // Auth required for all access
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware

    const query = getQuery(event);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const offset = (page - 1) * limit;
    const status = query.status as string | undefined;
    const search = query.search as string | undefined;
    const startDate = query.startDate as string | undefined;
    const endDate = query.endDate as string | undefined;
    const mine = query.mine === 'true' || query.mine === '1';
    const requesterId = query.requesterId as string | undefined;
    const templateId = query.templateId as string | undefined;

    // Build WHERE conditions
    const conditions = [];

    if (mine) {
      // Filter to only this user's requests
      conditions.push(eq(request.userId, userId));
    }

    if (status) {
      conditions.push(eq(request.status, status));
    }

    // Handle date range filtering
    if (startDate)
      conditions.push(gte(request.createdAt, new Date(startDate).toISOString()));
    if (endDate)
      conditions.push(lte(request.createdAt, new Date(endDate).toISOString()));

    if (search) {
      // Search by template name, student id, and student name (EN/TH, first/last/full)
      conditions.push(
        or(
          ilike(requestTemplate.name, `%${search}%`),
          ilike(users.studentId, `%${search}%`),
          ilike(users.firstNameEn, `%${search}%`),
          ilike(users.lastNameEn, `%${search}%`),
          ilike(users.firstNameTh, `%${search}%`),
          ilike(users.lastNameTh, `%${search}%`),
          // Full name (EN)
          ilike(sql`CONCAT_WS(' ', ${users.firstNameEn}, ${users.lastNameEn})`, `%${search}%`),
          // Full name (TH)
          ilike(sql`CONCAT(${users.firstNameTh}, ' ', ${users.lastNameTh})`, `%${search}%`),
        ),
      );
    }

    if (requesterId) {
      conditions.push(eq(request.userId, requesterId));
    }

    if (templateId) {
      const templateIdNum = Number(templateId);
      if (!Number.isNaN(templateIdNum)) {
        conditions.push(eq(request.templateId, templateIdNum));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({
        total: count(),
        inProgress: count(sql`CASE WHEN ${request.status} = 'in_progress' THEN 1 END`),
        rejected: count(sql`CASE WHEN ${request.status} = 'rejected' THEN 1 END`),
        completed: count(sql`CASE WHEN ${request.status} = 'completed' THEN 1 END`),
      })
      .from(request)
      .leftJoin(requestTemplate, eq(request.templateId, requestTemplate.id))
      .leftJoin(users, eq(request.userId, users.id))
      .where(whereClause);

    const total = countResult?.total ?? 0;

    // Get paginated data with template name and requester info
    const data = await db
      .select({
        id: request.id,
        templateId: request.templateId,
        templateName: requestTemplate.name,
        status: request.status,
        createdBy: request.createdBy,
        requesterName: sql<string>`CONCAT_WS(' ', ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})`,
        requesterNameTh: sql<string>`CONCAT(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`,
        studentId: users.id,
        studentNameEn: sql<string>`CONCAT_WS(' ', ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})`,
        studentNameTh: sql<string>`CONCAT(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`,
        submittedAt: request.submittedAt,
        filledDocumentUrl: request.filledDocumentUrl,
        createdAt: request.createdAt,
      })
      .from(request)
      .leftJoin(requestTemplate, eq(request.templateId, requestTemplate.id))
      .leftJoin(users, eq(request.userId, users.id))
      .where(whereClause)
      .orderBy(desc(request.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      success: true,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        statusCounts: {
          in_progress: countResult?.inProgress ?? 0,
          rejected: countResult?.rejected ?? 0,
          completed: countResult?.completed ?? 0,
        },
      },
    };
  }
  catch (error: any) {
    console.error('Error fetching requests:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch requests',
    });
  }
});
