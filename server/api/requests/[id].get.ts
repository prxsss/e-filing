import { eq } from 'drizzle-orm';

import db from '../../../lib/db';
import { request, requestTemplateValues, signatureFlow, userRoles } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware

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

    // Access control: the requester must be the owner OR have a signing role in this request
    const isOwner = record.userId === userId;
    if (!isOwner) {
      const userRoleRows = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, userId));
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
