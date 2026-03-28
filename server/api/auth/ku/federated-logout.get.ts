import env from '~~/lib/env';

export default defineEventHandler(async (event) => {
  // Clear local session only after returning from KU end-session.
  await clearUserSession(event);

  return sendRedirect(event, new URL('/login', env.APP_URL).toString());
});
