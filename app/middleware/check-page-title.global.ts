export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig();

  if (config.public.nodeEnv === 'development' && !to.meta.title) {
    console.warn(`⚠️ Missing title in page: ${to.path}`);
  }
});
