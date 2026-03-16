import db from '~~/lib/db';
import { userRoles, users } from '~~/lib/db/schema';
import * as zod from 'zod';

const createUserSchema = zod.object({
  id: zod.string().min(1, 'ID is required'),
  firstNameEn: zod.string().min(1, 'First name (EN) is required'),
  lastNameEn: zod.string().min(1, 'Last name (EN) is required'),
  firstNameTh: zod.string().min(1, 'First name (Thai) is required'),
  lastNameTh: zod.string().min(1, 'Last name (Thai) is required'),
  email: zod.email(),
  password: zod.string().min(8, 'Password must be at least 8 characters long'),
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

  const hashedPassword = await hashPassword(body.password);

  const user = await db.transaction(async (tx) => {
    const [createdUser] = await tx.insert(users).values({
      id: body.id,
      firstNameEn: body.firstNameEn,
      lastNameEn: body.lastNameEn,
      email: body.email,
      passwordHash: hashedPassword,
      firstNameTh: body.firstNameTh,
      lastNameTh: body.lastNameTh,
      image: body.image,
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
