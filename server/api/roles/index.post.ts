import { createRole } from '~~/lib/db/queries/role';
import * as zod from 'zod';

const createRoleSchema = zod.object({
  name: zod.string().min(1, 'Role name (EN) is required'),
  nameTh: zod.string().min(1, 'Role name (TH) is required'),
  descriptionEn: zod.string().optional(),
  descriptionTh: zod.string().optional(),
  permissionIds: zod.array(zod.number()).optional(),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'role.create');

  const body = await readValidatedBody(event, createRoleSchema.parse);

  try {
    const role = await createRole({
      name: body.name.trim(),
      nameTh: body.nameTh.trim(),
      descriptionEn: body.descriptionEn,
      descriptionTh: body.descriptionTh,
      permissionIds: body.permissionIds,
    });

    return { success: true, role };
  }
  catch (error: any) {
    if (error?.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'A role with this name already exists' });
    }
    throw error;
  }
});
