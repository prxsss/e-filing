import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as z from 'zod';

const updateUserSchema = z.object({
  academicRankEn: z.string().max(20).optional(),
  titleEn: z.string().max(20).optional(),
  firstNameEn: z.string().min(1, 'First name (EN) is required'),
  lastNameEn: z.string().min(1, 'Last name (EN) is required'),
  academicRankTh: z.string().max(20).optional(),
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
      academicRankEn: body.academicRankEn?.trim() || null,
      titleEn: body.titleEn?.trim() || null,
      firstNameEn: body.firstNameEn.trim(),
      lastNameEn: body.lastNameEn.trim(),
      academicRankTh: body.academicRankTh?.trim() || null,
      titleTh: body.titleTh?.trim() || null,
      firstNameTh: body.firstNameTh.trim(),
      lastNameTh: body.lastNameTh.trim(),
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      academicRankEn: users.academicRankEn,
      titleEn: users.titleEn,
      firstNameEn: users.firstNameEn,
      lastNameEn: users.lastNameEn,
      academicRankTh: users.academicRankTh,
      titleTh: users.titleTh,
      firstNameTh: users.firstNameTh,
      lastNameTh: users.lastNameTh,
    });

  return {
    message: 'User updated successfully',
    user: updatedUser,
  };
});
