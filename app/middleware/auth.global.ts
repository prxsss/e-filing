export default defineNuxtRouteMiddleware((to) => {
  const session = useUserSession();
  const localPath = useLocalePath();

  if (to.meta.public)
    return;

  if (!session.loggedIn.value) {
    return navigateTo({
      path: localPath('/login'),
      query: { redirect: to.fullPath },
    }, { replace: true });
  }
});
