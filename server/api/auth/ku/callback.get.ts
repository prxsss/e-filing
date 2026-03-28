import type { AllowedTypePerson, KuAllCallback } from '~~/shared/types/ku-all-callback';

import db from '~~/lib/db';
import { departments, faculties, permissions, rolePermissions, roles, userRoles, users } from '~~/lib/db/schema';
import env from '~~/lib/env';
import { eq, sql } from 'drizzle-orm';

type TokenResponse = {
  access_token?: string;
  id_token?: string;
};

function getLoginRedirectUrl() {
  const url = new URL('/login', env.APP_URL);
  return url;
}

function getRedirectUri() {
  if (env.REDIRECT_URI.includes('/api/auth/ku/callback')) {
    return env.REDIRECT_URI;
  }

  return new URL('/api/auth/ku/callback', env.APP_URL).toString();
}

function resolveSafeRedirectPath(value: string | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('://')) {
    return null;
  }

  return value;
}

function getRoleIdForTypePerson(typePerson: AllowedTypePerson) {
  switch (typePerson) {
    // Teacher
    case '1':
      return 2;

    // Staff
    case '2':
      return 13;

    // Student
    case '3':
      return 1;

    // Student (หลักสูตรศาสตร์แห่งแผ่นดิน)
    case '7':
      return 1;

    // Student (ข้ามสถาบัน)
    case '8':
      return 1;
  }
}

async function getFacultyIdForKuAllFacultyId(kuAllFacultyId: string | undefined) {
  if (!kuAllFacultyId) {
    return null;
  }

  const faculty = await db.select({ id: faculties.id }).from(faculties).where(eq(faculties.facultyCode, kuAllFacultyId));
  return faculty[0]?.id;
}

async function getDepartmentIdForKuAllMajorId(majorId: string | undefined) {
  if (!majorId) {
    return null;
  }

  const department = await db.select({ id: departments.id }).from(departments).where(eq(departments.departmentCode, majorId));
  return department[0]?.id;
}

function getNameTitleEnForKuAllThaiPrename(thaiprename: string | undefined) {
  if (!thaiprename) {
    return undefined;
  }

  const mapping: Record<string, string> = {
    นาย: 'Mr.',
    นาง: 'Ms.',
    นางสาว: 'Miss.',
  };

  return mapping[thaiprename] ?? undefined;
}

function isAllowedTypePerson(
  value: string,
): boolean {
  return value === '1' || value === '2' || value === '3' || value === '7' || value === '8';
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const code = typeof query.code === 'string' ? query.code : '';
    const state = typeof query.state === 'string' ? query.state : '';
    const oauthError = typeof query.error === 'string' ? query.error : '';
    const oauthErrorDescription = typeof query.error_description === 'string' ? query.error_description : '';
    const oauthErrorUri = typeof query.error_uri === 'string' ? query.error_uri : '';
    const redirectUri = getRedirectUri();

    const storedState = getCookie(event, 'ku_oauth_state');
    const codeVerifier = getCookie(event, 'ku_oauth_code_verifier') ?? getCookie(event, 'ku-oauth_code_verifier');
    const requestedRedirect = resolveSafeRedirectPath(getCookie(event, 'ku_oauth_redirect'));

    deleteCookie(event, 'ku_oauth_state', { path: '/' });
    deleteCookie(event, 'ku_oauth_code_verifier', { path: '/' });
    deleteCookie(event, 'ku-oauth_code_verifier', { path: '/' });
    deleteCookie(event, 'ku_oauth_redirect', { path: '/' });

    if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
      console.warn('[KU OAuth] invalid callback payload', {
        hasCode: Boolean(code),
        hasState: Boolean(state),
        hasStoredState: Boolean(storedState),
        hasCodeVerifier: Boolean(codeVerifier),
        error: oauthError || undefined,
        errorDescription: oauthErrorDescription || undefined,
        errorUri: oauthErrorUri || undefined,
      });
      return sendRedirect(event, getLoginRedirectUrl().toString());
    }

    const tokenResponse = await $fetch<TokenResponse>(env.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier,
      }).toString(),
    });

    const accessToken = tokenResponse.access_token;
    const idToken = tokenResponse.id_token;
    if (!accessToken) {
      console.warn('[KU OAuth] missing access_token in token response');
      return sendRedirect(event, getLoginRedirectUrl().toString());
    }

    const userInfo = await $fetch<KuAllCallback>(env.USER_INFO_ENDPOINT, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    const SRIRACHA_CAMPUS_CODE = 'S';
    if (!isAllowedTypePerson(userInfo['type-person']) || userInfo.campus !== SRIRACHA_CAMPUS_CODE) {
      console.warn('[KU OAuth] unsupported type-person or campus', { typePerson: userInfo['type-person'], campus: userInfo.campus });
      return sendRedirect(event, getLoginRedirectUrl().toString());
    }

    const [existingUser] = await db
      .select({
        id: users.id,
        isActive: users.isActive,
        firstNameEn: users.firstNameEn,
        lastNameEn: users.lastNameEn,
      })
      .from(users)
      .where(eq(users.id, userInfo.uid))
      .limit(1);

    if (!existingUser) {
      await db.transaction(async (tx) => {
        const [facultyId, departmentId] = await Promise.all([
          getFacultyIdForKuAllFacultyId(userInfo['faculty-id']),
          getDepartmentIdForKuAllMajorId(userInfo['major-id']),
        ]);

        await tx.insert(users).values({
          id: userInfo.uid,
          titleEn: getNameTitleEnForKuAllThaiPrename(userInfo.thaiprename),
          titleTh: userInfo.thaiprename,
          firstNameEn: userInfo.givenname,
          lastNameEn: userInfo.surname,
          firstNameTh: userInfo['first-name'],
          lastNameTh: userInfo['last-name'],
          email: userInfo['google-mail'] ?? '',
          isActive: true,
        });

        await tx.insert(userRoles).values({
          userId: userInfo.uid,
          roleId: getRoleIdForTypePerson(userInfo['type-person'] as AllowedTypePerson),
          facultyId,
          departmentId,
        });
      });
    }
    // else {
    //   await db
    //     .update(users)
    //     .set({
    //       firstNameEn: userInfo.givenname,
    //       lastNameEn: userInfo.surname,
    //       firstNameTh: userInfo['first-name'],
    //       lastNameTh: userInfo['last-name'],
    //       email: userInfo['google-mail']!,
    //       isActive: true,
    //       updatedAt: new Date().toISOString(),
    //     })
    //     .where(eq(users.id, userInfo.uid));
    // }

    const [user] = await db
      .select({
        id: users.id,
        fullNameEn: sql<string>`
          concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})
        `,
        fullNameTh: sql<string>`
          concat_ws(' ', ${users.titleTh}, ${users.firstNameTh}, ${users.lastNameTh})
        `,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userInfo.uid))
      .limit(1);

    if (!user) {
      console.warn('[KU OAuth] user lookup failed after upsert', { uid: userInfo.uid });
      return sendRedirect(event, getLoginRedirectUrl().toString());
    }

    const [userAuth] = await db
      .select({
        roles: sql<string[]>`array_agg(DISTINCT ${roles.name})`,
        permissions: sql<string[]>`array_agg(DISTINCT ${permissions.code})`,
      })
      .from(userRoles)
      .leftJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, user.id));

    const mappedRoles = userAuth?.roles ?? [];
    const mappedPermissions = userAuth?.permissions ?? [];

    await setUserSession(event, {
      user: {
        id: user.id,
        fullNameEn: user.fullNameEn,
        fullNameTh: user.fullNameTh,
        roles: mappedRoles,
        currentRole: mappedRoles[0] ?? '',
        permissions: mappedPermissions,
        typePerson: userInfo['type-person'],
        campus: userInfo.campus,
        email: user.email,
        idToken,
        authProvider: 'ku-all-login',
      },
      lastLoggedIn: new Date(),
    });

    const redirectTarget = requestedRedirect ?? '/';
    return sendRedirect(event, new URL(redirectTarget, env.APP_URL).toString());
  }
  catch (error) {
    console.error('[KU OAuth] callback failed', error);
    return sendRedirect(event, getLoginRedirectUrl().toString());
  }
});
