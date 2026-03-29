export default defineNuxtRouteMiddleware(async (to) => {
  const session = useUserSession();
  const localPath = useLocalePath();

  if (to.meta.public)
    return;

  try {
    await session.fetch();
  }
  catch {
    // Ignore fetch failures and rely on loggedIn state for redirect.
  }

  if (!session.loggedIn.value) {
    return navigateTo({
      path: localPath('/login'),
      query: { redirect: to.fullPath },
    }, { replace: true });
  }
});
