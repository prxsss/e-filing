import db from '~~/lib/db';
import { activationOtps, users } from '~~/lib/db/schema';
import { resetPasswordOtpTemplate } from '~~/server/utils/email/templates/reset-password-otp';
import { USER_STATUS } from '~~/shared/types/user-status';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import * as zod from 'zod';

const requestOtpSchema = zod.object({
  email: zod.email(),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, requestOtpSchema.parse);

  const [existingUser] = await db
    .select({
      id: users.id,
      email: users.email,
      fullNameTh: sql<string>`
          concat_ws(' ', ${users.titleTh}, ${users.firstNameTh}, ${users.lastNameTh})
      `,
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

  // KU ALL Account
  if (!existingUser.passwordHash) {
    throw createError({ statusCode: 400, message: 'This account does not support password reset.' });
  }

  const recentOtp = await db
    .select({ id: activationOtps.id })
    .from(activationOtps)
    .where(and(
      eq(activationOtps.userId, existingUser.id),
      gt(activationOtps.createdAt, sql`NOW() - INTERVAL '1 minute'`),
    ))
    .limit(1);

  if (recentOtp.length > 0) {
    throw createError({ statusCode: 429, message: 'Please wait 1 minute before requesting a new OTP.' });
  }

  await db
    .update(activationOtps)
    .set({ usedAt: new Date().toISOString() })
    .where(and(
      eq(activationOtps.userId, existingUser.id),
      isNull(activationOtps.usedAt),
    ));

  const otp = randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await db.insert(activationOtps).values({
    userId: existingUser.id,
    otp,
    expiresAt,
  });

  await emailService.send(resetPasswordOtpTemplate({
    to: existingUser.email,
    name: existingUser.fullNameTh,
    otp,
  }));

  return { success: true };
});
