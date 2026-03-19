export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();

  if (authStore.can('dashboard.admin.view') && (to.path === '/' || to.path === '/admin' || to.path === '/admin/')) {
    return navigateTo('/admin/requests');
  }
}); ;
