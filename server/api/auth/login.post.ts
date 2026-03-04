import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as zod from 'zod';

const loginSchema = zod.object({
  email: zod.email(),
  password: zod.string(),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, loginSchema.parse);

  const [user] = await db.select().from(users).where(eq(users.email, body.email));
  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' });
  }

  const passwordMatch = await verifyPassword(user.passwordHash, body.password);
  if (!passwordMatch) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' });
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      fullName: `${user.firstNameEN} ${user.lastNameEN}`,
    },
    lastLoggedIn: new Date(),
  });

  return { success: true, user: { id: user.id, email: user.email } };
});
