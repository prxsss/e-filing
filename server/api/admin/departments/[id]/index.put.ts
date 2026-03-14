import { getDepartmentById, updateDepartmentById } from '~~/lib/db/queries/department';
import * as zod from 'zod';

const updateDepartmentSchema = zod.object({
  departmentCode: zod.string().trim().min(1, 'Department code is required').max(20),
  facultyId: zod.number().int().positive('Faculty is required'),
  nameEn: zod.string().trim().min(1, 'Department name (EN) is required').max(255),
  nameTh: zod.string().trim().min(1, 'Department name (TH) is required').max(255),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'department.edit');

  const idParam = getRouterParam(event, 'id');
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid department id' });
  }

  const body = await readValidatedBody(event, updateDepartmentSchema.parse);

  const existingDepartment = await getDepartmentById(id);
  if (!existingDepartment) {
    throw createError({ statusCode: 404, message: `Department with ID ${id} not found` });
  }

  try {
    const department = await updateDepartmentById(id, {
      departmentCode: body.departmentCode.toUpperCase(),
      facultyId: body.facultyId,
      nameEn: body.nameEn,
      nameTh: body.nameTh,
    });

    if (!department) {
      throw createError({ statusCode: 500, message: 'Failed to update department' });
    }

    return {
      success: true,
      message: 'Department updated successfully',
      department,
    };
  }
  catch (error: any) {
    if (error?.code === '23505') {
      throw createError({ statusCode: 409, message: 'Department code already exists' });
    }

    throw error;
  }
});
