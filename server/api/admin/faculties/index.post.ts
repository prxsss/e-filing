import { createFaculty } from '~~/lib/db/queries/faculty';
import * as zod from 'zod';

const createFacultySchema = zod.object({
  facultyCode: zod.string().trim().min(1, 'Faculty code is required').max(20),
  nameEn: zod.string().trim().min(1, 'Faculty name (EN) is required').max(255),
  nameTh: zod.string().trim().min(1, 'Faculty name (TH) is required').max(255),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'faculty.create');

  const body = await readValidatedBody(event, createFacultySchema.parse);

  try {
    const faculty = await createFaculty(body);

    if (!faculty) {
      throw createError({ statusCode: 500, message: 'Failed to create faculty' });
    }

    return { success: true, faculty };
  }
  catch (error: any) {
    if (error?.code === '23505') {
      throw createError({ statusCode: 409, message: 'Faculty code already exists' });
    }

    throw error;
  }
});
