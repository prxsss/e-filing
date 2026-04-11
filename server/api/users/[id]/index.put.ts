import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import * as z from 'zod';

const updateUserSchema = z.object({
  studentId: z.string().optional(),
  staffId: z.string().optional(),
  titleEn: z.string().max(20).optional(),
  firstNameEn: z.string().min(1, 'First name (EN) is required'),
  lastNameEn: z.string().min(1, 'Last name (EN) is required'),
  titleTh: z.string().max(20).optional(),
  firstNameTh: z.string().min(1, 'First name (Thai) is required'),
  lastNameTh: z.string().min(1, 'Last name (Thai) is required'),
  email: z.email('Invalid email address'),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.edit');

  const id = getRouterParam(event, 'id') as string;
  const body = await readValidatedBody(event, updateUserSchema.parse);
  const normalizedEmail = body.email.trim();
  const normalizedStudentId = body.studentId?.trim() || null;
  const normalizedStaffId = body.staffId?.trim() || null;

  if (normalizedStudentId && normalizedStaffId) {
    throw createError({
      statusCode: 400,
      message: 'Student ID and Staff ID cannot both be provided',
      data: {
        code: 'STUDENT_STAFF_EXCLUSIVE',
        fields: ['studentId', 'staffId'],
      },
    });
  }

  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) {
    throw createError({ statusCode: 404, message: `User with ID ${id} not found` });
  }

  const [existingByEmail, existingByStudentId, existingByStaffId] = await Promise.all([
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, normalizedEmail), ne(users.id, id)))
      .limit(1),
    normalizedStudentId
      ? db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.studentId, normalizedStudentId), ne(users.id, id)))
          .limit(1)
      : Promise.resolve([]),
    normalizedStaffId
      ? db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.staffId, normalizedStaffId), ne(users.id, id)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const duplicateFields: Array<'email' | 'studentId' | 'staffId'> = [];
  if (existingByEmail[0]) {
    duplicateFields.push('email');
  }
  if (existingByStudentId[0]) {
    duplicateFields.push('studentId');
  }
  if (existingByStaffId[0]) {
    duplicateFields.push('staffId');
  }

  if (duplicateFields.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Duplicate user fields',
      data: {
        code: 'DUPLICATE_USER_FIELDS',
        fields: duplicateFields,
      },
    });
  }

  let updatedUser;

  try {
    [updatedUser] = await db.update(users)
      .set({
        studentId: normalizedStudentId,
        staffId: normalizedStaffId,
        titleEn: body.titleEn?.trim() || null,
        firstNameEn: body.firstNameEn.trim(),
        lastNameEn: body.lastNameEn.trim(),
        titleTh: body.titleTh?.trim() || null,
        firstNameTh: body.firstNameTh.trim(),
        lastNameTh: body.lastNameTh.trim(),
        email: normalizedEmail,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        studentId: users.studentId,
        staffId: users.staffId,
        titleEn: users.titleEn,
        firstNameEn: users.firstNameEn,
        lastNameEn: users.lastNameEn,
        titleTh: users.titleTh,
        firstNameTh: users.firstNameTh,
        lastNameTh: users.lastNameTh,
        email: users.email,
      });
  }
  catch (error: any) {
    if (error?.code === '23505') {
      const duplicateFieldByConstraint: Record<string, 'email' | 'studentId' | 'staffId'> = {
        users_email_unique: 'email',
        users_student_id_key: 'studentId',
        users_staff_id_key: 'staffId',
      };

      const duplicateField = duplicateFieldByConstraint[error?.constraint ?? ''];
      if (duplicateField) {
        throw createError({
          statusCode: 409,
          message: 'Duplicate user fields',
          data: {
            code: 'DUPLICATE_USER_FIELDS',
            fields: [duplicateField],
          },
        });
      }

      throw createError({
        statusCode: 409,
        message: 'Duplicate user fields',
        data: {
          code: 'DUPLICATE_USER_FIELDS',
          fields: [],
        },
      });
    }

    throw error;
  }

  return {
    message: 'User updated successfully',
    user: updatedUser,
  };
});
