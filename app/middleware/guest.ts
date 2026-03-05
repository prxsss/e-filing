export default defineNuxtRouteMiddleware(() => {
  const session = useUserSession();
  const localePath = useLocalePath();

  if (session.loggedIn.value) {
    return navigateTo(localePath('/'));
  }
});
