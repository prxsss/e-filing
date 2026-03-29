import db from '~~/lib/db';
import { roles, userRoles, users } from '~~/lib/db/schema';
import { inArray } from 'drizzle-orm';
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
