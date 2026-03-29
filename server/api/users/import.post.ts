import db from '~~/lib/db';
import { roles, userRoles, users } from '~~/lib/db/schema';
import { inArray } from 'drizzle-orm';
// import env from '~~/lib/env';
import * as zod from 'zod';

const bulkImportUserSchema = zod.object({
  rowNumber: zod.number().int().positive(),
  studentId: zod.string().optional(),
  staffId: zod.string().optional(),
  titleEn: zod.string().max(20).optional(),
  firstNameEn: zod.string().min(1, 'First name (EN) is required'),
  lastNameEn: zod.string().min(1, 'Last name (EN) is required'),
  titleTh: zod.string().max(20).optional(),
  firstNameTh: zod.string().min(1, 'First name (Thai) is required'),
  lastNameTh: zod.string().min(1, 'Last name (Thai) is required'),
  email: zod.email(),
  image: zod.string().optional(),
  roleAssignments: zod.array(zod.object({
    roleId: zod.number(),
    facultyId: zod.number().nullable(),
    departmentId: zod.number().nullable(),
  })).min(1, 'At least one role is required'),
});

const bulkImportSchema = zod.object({
  users: zod.array(bulkImportUserSchema).min(1, 'At least one user is required'),
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.import');

  const body = await readValidatedBody(event, bulkImportSchema.parse);
  const isStudentRoleName = (name?: string | null) => {
    if (!name)
      return false;
    const normalizedName = name.trim().toLowerCase();
    return ['student', 'นิสิต'].some(keyword => normalizedName === keyword || normalizedName.includes(keyword));
  };

  const allAssignedRoleIds = [...new Set(body.users.flatMap(user => user.roleAssignments.map(role => role.roleId)))];
  const roleRows = allAssignedRoleIds.length > 0
    ? await db.select({
        id: roles.id,
        name: roles.name,
        nameTh: roles.nameTh,
      }).from(roles).where(inArray(roles.id, allAssignedRoleIds))
    : [];
  const roleById = new Map(roleRows.map(role => [role.id, role]));

  // const defaultPassword = env.IMPORT_USER_PASSWORD;

  // if (!defaultPassword || defaultPassword.length < 8) {
  //   throw createError({
  //     statusCode: 500,
  //     message: 'Import default password is not configured or too short',
  //   });
  // }

  // const hashedPassword = await hashPassword(defaultPassword);
  const failedRows: string[] = [];
  let success = 0;
  let failed = 0;

  for (const item of body.users) {
    try {
      const assignedRoleIds = [...new Set(item.roleAssignments.map(role => role.roleId))];
      const invalidRoleId = assignedRoleIds.find(roleId => !roleById.has(roleId));

      if (invalidRoleId) {
        throw createError({ statusCode: 400, message: `Invalid roleId: ${invalidRoleId}` });
      }

      const studentRoleIds = new Set(
        assignedRoleIds.filter((roleId) => {
          const role = roleById.get(roleId);
          if (!role)
            return false;
          return isStudentRoleName(role.name) || isStudentRoleName(role.nameTh);
        }),
      );

      const hasStudentRole = item.roleAssignments.some(role => studentRoleIds.has(role.roleId));
      const hasNonStudentRole = item.roleAssignments.some(role => !studentRoleIds.has(role.roleId));

      if (hasStudentRole && hasNonStudentRole) {
        throw createError({
          statusCode: 400,
          message: 'Student role must be assigned alone and cannot be combined with other roles',
        });
      }

      await db.transaction(async (tx) => {
        const [createdUser] = await tx.insert(users).values({
          studentId: item.studentId?.trim() || null,
          staffId: item.staffId?.trim() || null,
          titleEn: item.titleEn?.trim() || null,
          firstNameEn: item.firstNameEn.trim(),
          lastNameEn: item.lastNameEn.trim(),
          titleTh: item.titleTh?.trim() || null,
          firstNameTh: item.firstNameTh.trim(),
          lastNameTh: item.lastNameTh.trim(),
          email: item.email,
          // passwordHash: hashedPassword,
          image: item.image,
        }).returning();

        if (!createdUser) {
          throw createError({ statusCode: 500, message: 'Failed to create user' });
        }

        await tx.insert(userRoles).values(
          item.roleAssignments.map(role => ({
            userId: createdUser.id,
            roleId: role.roleId,
            facultyId: role.facultyId,
            departmentId: role.departmentId,
          })),
        );
      });

      success += 1;
    }
    catch (error: any) {
      failed += 1;
      failedRows.push(`Row ${item.rowNumber}: ${error?.data?.message || error?.message || 'Unknown error'}`);
    }
  }

  return {
    success,
    failed,
    failedRows,
  };
});
