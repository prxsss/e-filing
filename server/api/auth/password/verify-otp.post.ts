import db from '~~/lib/db';
import { activationOtps, users } from '~~/lib/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import * as zod from 'zod';

const verifyOtpSchema = zod.object({
  email: zod.email(),
  otp: zod.string().length(6),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, verifyOtpSchema.parse);

  const [existingUser] = await db
    .select({
      id: users.id,
      isActive: users.isActive,
      banned: users.banned,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (!existingUser) {
    throw createError({ statusCode: 404, message: 'Email not found.' });
  }
  if (!existingUser.isActive) {
    throw createError({ statusCode: 400, message: 'This account is not activated.' });
  }
  if (existingUser.banned) {
    throw createError({ statusCode: 403, message: 'Account is banned.' });
  }
  if (!existingUser.passwordHash) {
    throw createError({ statusCode: 400, message: 'This account does not support password reset.' });
  }

  const [validOtp] = await db
    .select({ id: activationOtps.id })
    .from(activationOtps)
    .where(and(
      eq(activationOtps.userId, existingUser.id),
      eq(activationOtps.otp, body.otp),
      gt(activationOtps.expiresAt, new Date().toISOString()),
      isNull(activationOtps.usedAt),
    ))
    .limit(1);

  if (!validOtp) {
    throw createError({ statusCode: 400, message: 'Invalid or expired OTP.' });
  }

  return { success: true };
});
