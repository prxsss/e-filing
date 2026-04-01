export default defineNuxtRouteMiddleware(() => {
  const localePath = useLocalePath();
  return navigateTo(localePath('/404'));
});
