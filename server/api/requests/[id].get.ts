import { eq } from 'drizzle-orm';

import db from '../../../lib/db';
import { request, requestTemplateValues, signatureFlow, userRoles } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event);
    if (!session?.user?.id) {
      throw createError({ statusCode: 401, message: 'Unauthorized' });
    }

    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!requestId) {
      return {
        success: false,
        error: 'Invalid request ID',
      };
    }

    // Get request details
    const requestData = await db
      .select()
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (requestData.length === 0) {
      return {
        success: false,
        error: 'Request not found',
      };
    }

    const record = requestData[0];

    // Access control:
    //   1) Owner can always see their own request
    //   2) Admin/staff (anyone with at least one real permission) can see all requests
    //   3) Anyone with a signing role in this specific request can see it
    const isOwner = record.userId === session.user.id;
    const isAdmin = (session.user.permissions ?? []).some((p: string | null) => p != null);

    if (!isOwner && !isAdmin) {
      const userRoleRows = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, session.user.id));
      const userRoleIds = userRoleRows.map(r => r.roleId);

      const hasSigningRole = userRoleIds.length > 0
        ? (await db
            .select({ roleId: signatureFlow.roleId })
            .from(signatureFlow)
            .where(eq(signatureFlow.requestId, requestId))
            .then(rows => rows.some(r => userRoleIds.includes(r.roleId))))
        : false;

      if (!hasSigningRole) {
        throw createError({ statusCode: 403, message: 'Forbidden' });
      }
    }

    // Get field values for this request
    const fieldValues = await db
      .select()
      .from(requestTemplateValues)
      .where(eq(requestTemplateValues.requestId, requestId));

    return {
      success: true,
      data: {
        request: record,
        fieldValues,
      },
    };
  }
  catch (error: any) {
    console.error('Error fetching request:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch request',
    };
  }
});
