import { createDepartment } from '~~/lib/db/queries/department';
import * as zod from 'zod';

const createDepartmentSchema = zod.object({
  departmentCode: zod.string().trim().min(1, 'Department code is required').max(20),
  facultyId: zod.number().int().positive('Faculty is required'),
  nameEn: zod.string().trim().min(1, 'Department name (EN) is required').max(255),
  nameTh: zod.string().trim().min(1, 'Department name (TH) is required').max(255),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'department.create');

  const body = await readValidatedBody(event, createDepartmentSchema.parse);

  try {
    const department = await createDepartment({
      departmentCode: body.departmentCode.toUpperCase(),
      facultyId: body.facultyId,
      nameEn: body.nameEn,
      nameTh: body.nameTh,
    });

    if (!department) {
      throw createError({ statusCode: 500, message: 'Failed to create department' });
    }

    return { success: true, department };
  }
  catch (error: any) {
    if (error?.code === '23505') {
      throw createError({ statusCode: 409, message: 'Department code already exists' });
    }

    throw error;
  }
});
