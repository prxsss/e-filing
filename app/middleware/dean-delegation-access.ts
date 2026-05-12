export default defineNuxtRouteMiddleware(async () => {
  try {
    const result = await $fetch<{ success: boolean; canAccess: boolean }>('/api/requests/dean-delegation-access');
    if (!result?.canAccess) {
      return navigateTo('/403');
    }
  }
  catch {
    return navigateTo('/403');
  }
});
