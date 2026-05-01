import db from '~~/lib/db';
import { activationOtps, departments, faculties, permissions, rolePermissions, roles, userRoles, users } from '~~/lib/db/schema';
import { USER_STATUS } from '~~/shared/types/user-status';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const { email, otp, password } = await readBody(event);

  const [existingUser] = await db
    .select({
      id: users.id,
      studentId: users.studentId,
      staffId: users.staffId,
      titleEn: users.titleEn,
      fullNameEn: sql<string>`
          concat_ws(' ', ${users.firstNameEn}, ${users.lastNameEn})
        `,
      titleTh: users.titleTh,
      fullNameTh: sql<string>`
          concat_ws(' ', ${users.firstNameTh}, ${users.lastNameTh})
        `,
      email: users.email,
      status: users.status,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existingUser) {
    throw createError({ statusCode: 404, message: 'Email not found.' });
  }

  if (existingUser.status === USER_STATUS.BANNED) {
    throw createError({ statusCode: 403, message: 'Account is banned.' });
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
      .set({ passwordHash, status: USER_STATUS.ACTIVE })
      .where(eq(users.id, existingUser.id));
  });

  const [userAuth] = await db
    .select({
      roles: sql<string[]>`coalesce(array_agg(DISTINCT ${roles.name}), '{}')`,
      rolesTh: sql<string[]>`coalesce(array_agg(DISTINCT ${roles.nameTh}), '{}')`,
      permissions: sql<string[]>`coalesce(array_agg(DISTINCT ${permissions.code}), '{}')`,
      facultyNameTh: sql<string | null>`max(${faculties.nameTh})`,
      departmentCode: sql<string | null>`max(${departments.departmentCode})`,
      departmentNameTh: sql<string | null>`max(${departments.nameTh})`,
    })
    .from(userRoles)
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .leftJoin(faculties, eq(userRoles.facultyId, faculties.id))
    .leftJoin(departments, eq(userRoles.departmentId, departments.id))
    .where(eq(userRoles.userId, existingUser.id));

  // Log in the user immediately after activation
  await setUserSession(event, {
    user: {
      id: existingUser.id,
      studentId: existingUser.studentId || undefined,
      staffId: existingUser.staffId || undefined,
      fullNameEn: existingUser.fullNameEn,
      fullNameTh: existingUser.fullNameTh,
      titleEn: existingUser.titleEn || undefined,
      titleTh: existingUser.titleTh || undefined,
      roles: userAuth.roles,
      rolesTh: userAuth.rolesTh,
      currentRole: userAuth.roles[0],
      permissions: userAuth.permissions,
      email: existingUser.email,
      facultyNameTh: userAuth.facultyNameTh || undefined,
      departmentCode: userAuth.departmentCode || undefined,
      departmentNameTh: userAuth.departmentNameTh || undefined,
      authProvider: 'local',
    },
    lastLoggedIn: new Date(),
  });

  return { success: true };
});
