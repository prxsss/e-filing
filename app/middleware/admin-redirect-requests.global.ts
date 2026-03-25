export default defineNuxtRouteMiddleware((to) => {
  return;

  const authStore = useAuthStore();

  if (authStore.can('dashboard.admin.view') && (to.path === '/' || to.path === '/en' || to.path === '/en/' || to.path === '/admin' || to.path === '/en/admin' || to.path === '/admin/' || to.path === '/en/admin/')) {
    return navigateTo('/admin/requests');
  }
}); ;
