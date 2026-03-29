import { hasExactlyOneDashboardPermission } from '~~/lib/db/queries/permission';
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

  const permissionIds = body.permissionIds ?? [];
  const hasExactlyOneDashboard = await hasExactlyOneDashboardPermission(permissionIds);
  if (!hasExactlyOneDashboard) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Role must include exactly one dashboard permission',
      data: { code: 'INVALID_DASHBOARD_PERMISSION_COUNT' },
    });
  }

  try {
    const role = await createRole({
      name: body.name.trim(),
      nameTh: body.nameTh.trim(),
      descriptionEn: body.descriptionEn,
      descriptionTh: body.descriptionTh,
      permissionIds,
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
