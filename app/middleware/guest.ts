export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore();
  const localePath = useLocalePath();

  if (authStore.user) {
    return navigateTo(localePath('/'));
  }

  const sessionToken = useCookie('better-auth.session_token');

  if (sessionToken.value) {
    return navigateTo(localePath('/'));
  }
});
