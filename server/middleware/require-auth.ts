import db from '~~/lib/db';
import { users } from '~~/lib/db/schema';
import { eq } from 'drizzle-orm';

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/ku/login',
  '/api/auth/ku/callback',
  '/api/auth/ku/logout',
  '/api/auth/ku/federated-logout',
  '/api/auth/activation/request-otp',
  '/api/auth/activation/verify',
  '/api/auth/activation/verify-otp',
  '/api/auth/password/request-otp',
  '/api/auth/password/verify-otp',
  '/api/auth/password/reset',
];

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith('/api') || PUBLIC_ROUTES.includes(path)) {
    return;
  }

  const { user } = await requireUserSession(event);

  const [currentUser] = await db
    .select({
      id: users.id,
      banned: users.banned,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!currentUser || currentUser.banned) {
    await clearUserSession(event);
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    });
  }

  event.context.user = user;
});
