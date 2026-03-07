import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import * as zod from 'zod';

const createUserSchema = zod.object({
  id: zod.string().min(1, 'ID is required'),
  firstNameEn: zod.string().min(1, 'First name (EN) is required'),
  lastNameEn: zod.string().min(1, 'Last name (EN) is required'),
  firstNameTh: zod.string().optional(),
  lastNameTh: zod.string().optional(),
  email: zod.email(),
  password: zod.string().min(8, 'Password must be at least 8 characters long'),
  facultyId: zod.number().nullable(),
  image: zod.string().optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, createUserSchema.parse);

  const hashedPassword = await hashPassword(body.password);

  const [user] = await db.insert(users).values({
    id: body.id,
    firstNameEn: body.firstNameEn,
    lastNameEn: body.lastNameEn,
    email: body.email,
    passwordHash: hashedPassword,
    firstNameTh: body.firstNameTh,
    lastNameTh: body.lastNameTh,
    facultyId: body.facultyId,
    image: body.image,
  }).returning();

  if (!user) {
    throw createError({ statusCode: 500, message: 'Failed to create user' });
  }

  return { success: true, user: { id: user.id, email: user.email } };
});
