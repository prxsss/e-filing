import { count, desc, eq } from 'drizzle-orm';

import db from '../../../lib/db';
import { request } from '../../../lib/db/schema/request';
import { requestTemplate } from '../../../lib/db/schema/request-template';

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const query = getQuery(event);
  const limit = Math.min(8, Math.max(1, Number(query.limit) || 4));

  // Count submissions per template, excluding drafts
  const popular = await db
    .select({
      id: requestTemplate.id,
      name: requestTemplate.name,
      description: requestTemplate.description,
      submissionCount: count(request.id).as('submission_count'),
    })
    .from(requestTemplate)
    .leftJoin(
      request,
      eq(request.templateId, requestTemplate.id),
    )
    .where(eq(requestTemplate.isActive, true))
    .groupBy(requestTemplate.id)
    .orderBy(desc(count(request.id)), desc(requestTemplate.createdAt))
    .limit(limit);

  return {
    success: true,
    data: popular,
  };
});
