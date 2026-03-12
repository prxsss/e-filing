import { updateRole } from '~~/lib/db/queries/role';
import * as z from 'zod';

const updateRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').optional(),
  descriptionEn: z.string().nullable().optional(),
  descriptionTh: z.string().nullable().optional(),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'role.edit');

  const id = Number(getRouterParam(event, 'id'));
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role ID' });
  }

  const body = await readValidatedBody(event, updateRoleSchema.parse);

  try {
    const role = await updateRole(id, body);
    if (!role) {
      throw createError({ statusCode: 404, statusMessage: 'Role not found' });
    }
    return { success: true, role };
  }
  catch (error: any) {
    if (error.statusCode)
      throw error;

    // Unique constraint violation
    if (error.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'A role with this name already exists' });
    }

    throw createError({ statusCode: 500, statusMessage: 'Failed to update role' });
  }
});
