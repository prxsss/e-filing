import { and, eq } from 'drizzle-orm';

import db from '../../../lib/db';
import { permissions, request, rolePermissions, roles, userRoles } from '../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware
    const body = await readBody(event);

    if (!body.templateId) {
      return {
        success: false,
        error: 'Template ID is required',
      };
    }

    // Check if user has permission to create a request and get their faculty/department association
    const [userRole] = await db
      .select({
        facultyId: userRoles.facultyId,
        departmentId: userRoles.departmentId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(permissions.code, 'request.create'),
        ),
      );

    if (!userRole) {
      return {
        success: false,
        error: 'You do not have permission to create a request.',
      };
    }

    if (userRole.facultyId === null || userRole.departmentId === null) {
      return {
        success: false,
        error: 'You do not have an associated faculty or department.',
      };
    }

    // Create new request, always associating it with the authenticated user
    const newRequest = await db.insert(request).values({
      templateId: body.templateId,
      userId,
      status: 'draft',
      facultyId: userRole.facultyId,
      departmentId: userRole.departmentId,
    }).returning();

    return {
      success: true,
      data: newRequest[0],
    };
  }
  catch (error: any) {
    console.error('Error creating request:', error);
    return {
      success: false,
      error: error.message || 'Failed to create request',
    };
  }
});
