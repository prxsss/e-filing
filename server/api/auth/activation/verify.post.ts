import db from '~~/lib/db';
import { activationOtps, permissions, rolePermissions, roles, userRoles, users } from '~~/lib/db/schema';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const { email, otp, password } = await readBody(event);

  const [existingUser] = await db
    .select({
      id: users.id,
      fullNameEn: sql<string>`
          concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})
        `,
      fullNameTh: sql<string>`
          concat_ws(' ', ${users.titleTh}, ${users.firstNameTh}, ${users.lastNameTh})
        `,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existingUser) {
    throw createError({ statusCode: 404, message: 'Email not found.' });
  }

  // Find a valid OTP
  const [validOtp] = await db
    .select()
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

  const passwordHash = await hashPassword(password);

  // Mark the OTP as used and activate the user within a transaction
  await db.transaction(async (tx) => {
    await tx
      .update(activationOtps)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(activationOtps.id, validOtp.id));

    await tx
      .update(users)
      .set({ passwordHash, isActive: true })
      .where(eq(users.id, existingUser.id));
  });

  const [userAuth] = await db
    .select({
      roles: sql<string[]>`array_agg(DISTINCT ${roles.name})`,
      permissions: sql<string[]>`array_agg(DISTINCT ${permissions.code})`,
    })
    .from(userRoles)
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, existingUser.id));

  // Log in the user immediately after activation
  await setUserSession(event, {
    user: {
      id: existingUser.id,
      fullNameEn: existingUser.fullNameEn,
      fullNameTh: existingUser.fullNameTh,
      roles: userAuth.roles,
      currentRole: userAuth.roles[0],
      permissions: userAuth.permissions,
    },
    lastLoggedIn: new Date(),
  });

  return { success: true };
});
