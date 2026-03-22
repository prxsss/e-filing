export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();
  const localePath = useLocalePath();

  const permission = to.meta.permission as string | undefined;

  if (permission && !authStore.can(permission)) {
    return navigateTo(localePath('/403'), { replace: true });
  }
});
