export default defineNuxtRouteMiddleware((to) => {
  const rootPaths = new Set(['/', '/en', '/en/']);
  if (!rootPaths.has(to.path))
    return;

  const authStore = useAuthStore();
  if (!authStore.session.loggedIn)
    return;

  const localePath = useLocalePath();

  if (authStore.can('dashboard.admin.view'))
    return navigateTo(localePath('/admin'), { replace: true });

  if (authStore.can('dashboard.signer.view'))
    return navigateTo(localePath('/signer'), { replace: true });

  if (authStore.can('dashboard.student.view'))
    return navigateTo(localePath('/student'), { replace: true });

  return navigateTo(localePath('/403'), { replace: true });
});
