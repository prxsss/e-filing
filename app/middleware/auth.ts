export default defineNuxtRouteMiddleware(() => {
  const session = useUserSession();
  const localPath = useLocalePath();
  if (!session.loggedIn.value) {
    return navigateTo(localPath('/login'));
  }
});
