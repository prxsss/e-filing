import { getFacultyById, updateFacultyById } from '~~/lib/db/queries/faculty';
import * as zod from 'zod';

const updateFacultySchema = zod.object({
  facultyCode: zod.string().trim().min(1, 'Faculty code is required').max(20),
  nameEn: zod.string().trim().min(1, 'Faculty name (EN) is required').max(255),
  nameTh: zod.string().trim().min(1, 'Faculty name (TH) is required').max(255),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'faculty.edit');

  const idParam = getRouterParam(event, 'id');
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid faculty id' });
  }

  const body = await readValidatedBody(event, updateFacultySchema.parse);

  const existingFaculty = await getFacultyById(id);
  if (!existingFaculty) {
    throw createError({ statusCode: 404, message: `Faculty with ID ${id} not found` });
  }

  try {
    const faculty = await updateFacultyById(id, body);

    if (!faculty) {
      throw createError({ statusCode: 500, message: 'Failed to update faculty' });
    }

    return {
      success: true,
      message: 'Faculty updated successfully',
      faculty,
    };
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
