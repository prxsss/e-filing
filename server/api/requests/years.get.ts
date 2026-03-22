import db from '~~/lib/db';
import { request } from '~~/lib/db/schema';
import { asc, sql } from 'drizzle-orm';

export default defineEventHandler(async (_event) => {
  try {
    const yearExpr = sql<number>`EXTRACT(YEAR FROM ${request.createdAt})::int`;

    const rows = await db
      .selectDistinct({
        year: yearExpr,
      })
      .from(request)
      .orderBy(asc(yearExpr));

    const years = rows.map(r => r.year).filter(Boolean);

    return { success: true, data: years };
  }
  catch (error: any) {
    console.error('Error fetching available years:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch available years',
    });
  }
});
