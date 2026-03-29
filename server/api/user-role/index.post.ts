import { addUserRole } from '~~/lib/db/queries/user-role';
import * as zod from 'zod';

const addUserRoleSchema = zod.object({
  userId: zod.string().min(1, 'userId is required'),
  roleId: zod.number().int().positive('roleId must be a positive integer'),
  facultyId: zod.number().int().positive().nullable().optional(),
  departmentId: zod.number().int().positive().nullable().optional(),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.edit');

  const { userId, roleId, facultyId, departmentId } = await readValidatedBody(event, addUserRoleSchema.parse);

  await addUserRole(userId, roleId, facultyId, departmentId);

  return { success: true };
});
