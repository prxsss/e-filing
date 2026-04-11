import db from '~~/lib/db';
import { roles, userRoles, users } from '~~/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import * as zod from 'zod';

const createUserSchema = zod.object({
  studentId: zod.string().optional(),
  staffId: zod.string().optional(),
  titleEn: zod.string().max(20).optional(),
  firstNameEn: zod.string().min(1, 'First name (EN) is required'),
  lastNameEn: zod.string().min(1, 'Last name (EN) is required'),
  titleTh: zod.string().max(20).optional(),
  firstNameTh: zod.string().min(1, 'First name (Thai) is required'),
  lastNameTh: zod.string().min(1, 'Last name (Thai) is required'),
  email: zod.email(),
  // password: zod.string().min(8, 'Password must be at least 8 characters long'),
  image: zod.string().optional(),
  roleAssignments: zod.array(zod.object({
    roleId: zod.number(),
    facultyId: zod.number().nullable(),
    departmentId: zod.number().nullable(),
  })).min(1, 'At least one role is required'),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.create');

  const body = await readValidatedBody(event, createUserSchema.parse);
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

  const [existingByEmail, existingByStudentId, existingByStaffId] = await Promise.all([
    db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1),
    normalizedStudentId
      ? db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.studentId, normalizedStudentId))
          .limit(1)
      : Promise.resolve([]),
    normalizedStaffId
      ? db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.staffId, normalizedStaffId))
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

  const isStudentRoleName = (name?: string | null) => {
    if (!name)
      return false;
    const normalizedName = name.trim().toLowerCase();
    return ['student', 'นิสิต'].some(keyword => normalizedName === keyword || normalizedName.includes(keyword));
  };

  const assignedRoleIds = [...new Set(body.roleAssignments.map(role => role.roleId))];
  const roleRows = await db.select({
    id: roles.id,
    name: roles.name,
    nameTh: roles.nameTh,
  }).from(roles).where(inArray(roles.id, assignedRoleIds));

  if (roleRows.length !== assignedRoleIds.length) {
    throw createError({ statusCode: 400, message: 'Some assigned roles are invalid' });
  }

  const studentRoleIds = new Set(
    roleRows
      .filter(role => isStudentRoleName(role.name) || isStudentRoleName(role.nameTh))
      .map(role => role.id),
  );

  const hasStudentRole = body.roleAssignments.some(role => studentRoleIds.has(role.roleId));
  const hasNonStudentRole = body.roleAssignments.some(role => !studentRoleIds.has(role.roleId));

  if (hasStudentRole && hasNonStudentRole) {
    throw createError({
      statusCode: 400,
      message: 'Student role must be assigned alone and cannot be combined with other roles',
    });
  }

  // const hashedPassword = await hashPassword(body.password);

  let user;

  try {
    user = await db.transaction(async (tx) => {
      const [createdUser] = await tx.insert(users).values({
        studentId: normalizedStudentId,
        staffId: normalizedStaffId,
        titleEn: body.titleEn?.trim() || null,
        firstNameEn: body.firstNameEn.trim(),
        lastNameEn: body.lastNameEn.trim(),
        titleTh: body.titleTh?.trim() || null,
        firstNameTh: body.firstNameTh.trim(),
        lastNameTh: body.lastNameTh.trim(),
        email: normalizedEmail,
        // passwordHash: hashedPassword,
        image: body.image || null,
      }).returning();

      if (!createdUser) {
        throw createError({ statusCode: 500, message: 'Failed to create user' });
      }

      await tx.insert(userRoles).values(
        body.roleAssignments.map(role => ({
          userId: createdUser.id,
          roleId: role.roleId,
          facultyId: role.facultyId,
          departmentId: role.departmentId,
        })),
      );

      return createdUser;
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

  if (!user) {
    throw createError({ statusCode: 500, message: 'Failed to create user' });
  }

  return { success: true, user: { id: user.id, email: user.email } };
});
