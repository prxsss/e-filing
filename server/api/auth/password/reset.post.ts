import db from '~~/lib/db';
import { activationOtps, users } from '~~/lib/db/schema';
import { USER_STATUS } from '~~/shared/types/user-status';
import { and, eq, gt, isNull } from 'drizzle-orm';
import * as zod from 'zod';

const resetPasswordSchema = zod.object({
  email: zod.email(),
  otp: zod.string().length(6),
  password: zod.string().min(8),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, resetPasswordSchema.parse);

  const [existingUser] = await db
    .select({
      id: users.id,
      status: users.status,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (!existingUser) {
    throw createError({ statusCode: 404, message: 'Email not found.' });
  }
  if (existingUser.status === USER_STATUS.INACTIVE) {
    throw createError({ statusCode: 400, message: 'This account is not activated.' });
  }
  if (existingUser.status === USER_STATUS.BANNED) {
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

  const passwordHash = await hashPassword(body.password);

  await db.transaction(async (tx) => {
    await tx
      .update(activationOtps)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(activationOtps.id, validOtp.id));

    await tx
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, existingUser.id));
  });

  return { success: true };
});
