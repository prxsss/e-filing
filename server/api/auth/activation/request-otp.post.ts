import db from '~~/lib/db';
import { activationOtps, users } from '~~/lib/db/schema';
import { activationOtpTemplate } from '~~/server/utils/email/templates/activation-otp';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event);

  // Check if the email exists in the system and is not yet activated
  const [existingUser] = await db
    .select({
      id: users.id,
      email: users.email,
      fullNameTh: sql<string>`
          concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
      `,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existingUser) {
    throw createError({ statusCode: 404, message: 'Email not found.' });
  }
  if (existingUser.isActive) {
    throw createError({ statusCode: 400, message: 'This account is already activated.' });
  }

  // Rate limit — prevent requesting OTP too frequently
  const recentOtp = await db
    .select()
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

  // Generate a 6-digit OTP
  const otp = randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes from now

  await db.insert(activationOtps).values({
    userId: existingUser.id,
    otp,
    expiresAt,
  });

  await emailService.send(activationOtpTemplate({
    to: existingUser.email,
    name: existingUser.fullNameTh,
    otp,
  }));

  return { success: true };
});
