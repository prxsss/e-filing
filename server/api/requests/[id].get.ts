import db from '~~/lib/db';
import { departments, request, requestTemplateValues, signatureFlow, userRoles, users } from '~~/lib/db/schema';
// import { request, requestTemplateValues } from '~~/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

import { hasPermission } from '../../utils/permission';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');
    const userId = event.context.user!.id;

    if (!requestId) {
      return {
        success: false,
        error: 'Invalid request ID',
      };
    }

    // Get request details
    const requestData = await db
      .select({
        id: request.id,
        templateId: request.templateId,
        status: request.status,
        filledDocumentUrl: request.filledDocumentUrl,
        createdAt: request.createdAt,
        submittedAt: request.submittedAt,
        userId: request.userId,
        note: request.note,
        requesterNameTh: sql<string>`CONCAT(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`,
        requesterNameEn: sql<string>`CONCAT_WS(' ', ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})`,
        requesterStudentId: users.studentId,
        requesterDepartmentNameTh: departments.nameTh,
        requesterDepartmentNameEn: departments.nameEn,
      })
      .from(request)
      .leftJoin(users, eq(request.userId, users.id))
      .leftJoin(departments, eq(request.departmentId, departments.id))
      .where(eq(request.id, requestId))
      .limit(1);

    if (requestData.length === 0) {
      return {
        success: false,
        error: 'Request not found',
      };
    }

    const record = requestData[0];

    // Access control: the requester must be the owner, or have request.view permission,
    // otherwise fall back to signing-role access.
    const isOwner = record.userId === userId;
    const canViewRequest = hasPermission(event, 'request.view');
    if (!isOwner && !canViewRequest) {
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
