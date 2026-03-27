import db from '~~/lib/db';
import { userRoles, users } from '~~/lib/db/schema';
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

  // const hashedPassword = await hashPassword(body.password);

  const user = await db.transaction(async (tx) => {
    const [createdUser] = await tx.insert(users).values({
      studentId: body.studentId?.trim() || null,
      staffId: body.staffId?.trim() || null,
      titleEn: body.titleEn?.trim() || null,
      firstNameEn: body.firstNameEn.trim(),
      lastNameEn: body.lastNameEn.trim(),
      titleTh: body.titleTh?.trim() || null,
      firstNameTh: body.firstNameTh.trim(),
      lastNameTh: body.lastNameTh.trim(),
      email: body.email,
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

  if (!user) {
    throw createError({ statusCode: 500, message: 'Failed to create user' });
  }

  return { success: true, user: { id: user.id, email: user.email } };
});
