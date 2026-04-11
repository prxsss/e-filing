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
    const errorCode = error?.code ?? error?.cause?.code;
    const errorConstraint = error?.constraint ?? error?.cause?.constraint;
    const combinedMessage = `${error?.message || ''} ${error?.cause?.message || ''}`.toLowerCase();

    const isUniqueViolation = errorCode === '23505'
      || combinedMessage.includes('duplicate key value violates unique constraint');

    const isFacultyCodeDuplicate = (errorConstraint && String(errorConstraint).includes('faculties_faculty_code'))
      || combinedMessage.includes('faculties_faculty_code')
      || combinedMessage.includes('faculty_code');

    if (isUniqueViolation && isFacultyCodeDuplicate) {
      throw createError({
        statusCode: 409,
        message: 'Faculty code already exists',
        data: {
          code: 'FACULTY_CODE_ALREADY_EXISTS',
        },
      });
    }

    throw error;
  }
});
