import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as z from 'zod';

const updateUserSchema = z.object({
  firstNameEn: z.string().min(1, 'First name (EN) is required'),
  lastNameEn: z.string().min(1, 'Last name (EN) is required'),
  facultyId: z.number().nullable(),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string;
  const body = await readValidatedBody(event, updateUserSchema.parse);

  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) {
    throw createError({ statusCode: 404, message: `User with ID ${id} not found` });
  }

  const [updatedUser] = await db.update(users)
    .set({
      firstNameEn: body.firstNameEn,
      lastNameEn: body.lastNameEn,
      facultyId: body.facultyId,
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      firstNameEn: users.firstNameEn,
      lastNameEn: users.lastNameEn,
      facultyId: users.facultyId,
    });

  return {
    message: 'User updated successfully',
    user: updatedUser,
  };
});
