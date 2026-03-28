const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/ku/login',
  '/api/auth/ku/callback',
  '/api/auth/ku/logout',
  '/api/auth/ku/federated-logout',
  '/api/auth/activation/request-otp',
  '/api/auth/activation/verify',
  '/api/auth/activation/verify-otp',
];

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith('/api') || PUBLIC_ROUTES.includes(path)) {
    return;
  }

  const { user } = await requireUserSession(event);

  event.context.user = user;
});
