import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import { eq } from 'drizzle-orm';
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
});

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'user.edit');

  const id = getRouterParam(event, 'id') as string;
  const body = await readValidatedBody(event, updateUserSchema.parse);

  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) {
    throw createError({ statusCode: 404, message: `User with ID ${id} not found` });
  }

  const [updatedUser] = await db.update(users)
    .set({
      studentId: body.studentId?.trim() || null,
      staffId: body.staffId?.trim() || null,
      titleEn: body.titleEn?.trim() || null,
      firstNameEn: body.firstNameEn.trim(),
      lastNameEn: body.lastNameEn.trim(),
      titleTh: body.titleTh?.trim() || null,
      firstNameTh: body.firstNameTh.trim(),
      lastNameTh: body.lastNameTh.trim(),
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
    });

  return {
    message: 'User updated successfully',
    user: updatedUser,
  };
});
