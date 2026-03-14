const PUBLIC_ROUTES = ['/api/auth/login'];

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith('/api') || PUBLIC_ROUTES.includes(path)) {
    return;
  }

  const { user } = await requireUserSession(event);

  event.context.user = user;
});
