import db from '~~/lib/db';
import { userRoles, users } from '~~/lib/db/schema';
import env from '~~/lib/env';
import * as zod from 'zod';

const bulkImportUserSchema = zod.object({
  rowNumber: zod.number().int().positive(),
  id: zod.string().min(1, 'ID is required'),
  firstNameEn: zod.string().min(1, 'First name (EN) is required'),
  lastNameEn: zod.string().min(1, 'Last name (EN) is required'),
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
  const defaultPassword = env.IMPORT_USER_PASSWORD;

  if (!defaultPassword || defaultPassword.length < 8) {
    throw createError({
      statusCode: 500,
      message: 'Import default password is not configured or too short',
    });
  }

  const hashedPassword = await hashPassword(defaultPassword);
  const failedRows: string[] = [];
  let success = 0;
  let failed = 0;

  for (const item of body.users) {
    try {
      await db.transaction(async (tx) => {
        const [createdUser] = await tx.insert(users).values({
          id: item.id,
          firstNameEn: item.firstNameEn,
          lastNameEn: item.lastNameEn,
          email: item.email,
          passwordHash: hashedPassword,
          firstNameTh: item.firstNameTh,
          lastNameTh: item.lastNameTh,
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
