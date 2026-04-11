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
    const errorCode = error?.code ?? error?.cause?.code;
    const errorConstraint = error?.constraint ?? error?.cause?.constraint;
    const combinedMessage = `${error?.message || ''} ${error?.cause?.message || ''}`.toLowerCase();

    const isUniqueViolation = errorCode === '23505'
      || combinedMessage.includes('duplicate key value violates unique constraint');

    const duplicateFieldByConstraint: Record<string, 'name' | 'nameTh'> = {
      roles_name_unique_ci: 'name',
      roles_name_th_unique_ci: 'nameTh',
    };

    const duplicateField = errorConstraint ? duplicateFieldByConstraint[String(errorConstraint)] : undefined;
    const isRoleNameDuplicate = Boolean(duplicateField)
      || combinedMessage.includes('roles_name_unique_ci')
      || combinedMessage.includes('roles_name_th_unique_ci');

    if (isUniqueViolation && isRoleNameDuplicate) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A role with this name already exists',
        data: {
          code: 'ROLE_NAME_ALREADY_EXISTS',
          fields: duplicateField ? [duplicateField] : [],
        },
      });
    }

    throw error;
  }
});
