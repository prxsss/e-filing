import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '../../../lib/db';
import { request } from '../../../lib/db/schema/request';
import { requestTemplate } from '../../../lib/db/schema/request-template';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const offset = (page - 1) * limit;
    const status = query.status as string | undefined;
    const search = query.search as string | undefined;
    const createdBy = query.createdBy ? Number(query.createdBy) : undefined;

    // Build WHERE conditions
    const conditions = [];

    if (createdBy) {
      conditions.push(eq(request.createdBy, createdBy));
    }

    if (status) {
      conditions.push(eq(request.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(requestTemplate.name, `%${search}%`),
          ilike(sql`CAST(${request.id} AS TEXT)`, `%${search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(request)
      .leftJoin(requestTemplate, eq(request.templateId, requestTemplate.id))
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    // Get paginated data with template name
    const data = await db
      .select({
        id: request.id,
        templateId: request.templateId,
        templateName: requestTemplate.name,
        templateCategory: requestTemplate.category,
        status: request.status,
        createdBy: request.createdBy,
        submittedAt: request.submittedAt,
        filledDocumentUrl: request.filledDocumentUrl,
        createdAt: request.createdAt,
      })
      .from(request)
      .leftJoin(requestTemplate, eq(request.templateId, requestTemplate.id))
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
