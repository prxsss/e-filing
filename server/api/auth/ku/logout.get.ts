import env from '~~/lib/env';

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  const idTokenHint = session?.user?.idToken;

  const endSessionUrl = new URL(env.END_SESSION_ENDPOINT);
  endSessionUrl.searchParams.set('client_id', env.CLIENT_ID);
  endSessionUrl.searchParams.set('post_logout_redirect_uri', env.LOGOUT_REDIRECT_URI);

  if (idTokenHint) {
    endSessionUrl.searchParams.set('id_token_hint', idTokenHint);
  }

  return sendRedirect(event, endSessionUrl.toString());
});
