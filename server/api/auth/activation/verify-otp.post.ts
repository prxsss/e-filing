import db from '~~/lib/db';
import { activationOtps, users } from '~~/lib/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const { email, otp } = await readBody(event);

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existingUser) {
    throw createError({ statusCode: 404, message: 'Email not found.' });
  }

  const [validOtp] = await db
    .select({ id: activationOtps.id })
    .from(activationOtps)
    .where(and(
      eq(activationOtps.userId, existingUser.id),
      eq(activationOtps.otp, otp),
      gt(activationOtps.expiresAt, new Date().toISOString()),
      isNull(activationOtps.usedAt),
    ))
    .limit(1);

  if (!validOtp) {
    throw createError({ statusCode: 400, message: 'Invalid or expired OTP.' });
  }

  return { success: true };
});
