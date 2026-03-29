import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', () => {
  const localePath = useLocalePath();

  const session = useUserSession();
  const errorMessage = ref<string | null>(null);
  const loading = ref(false);

  function resolveSafeRedirect(redirect?: string) {
    if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('://')) {
      return null;
    }

    return redirect;
  }

  function resolveLoginErrorMessage(error: unknown) {
    const fetchError = error as {
      data?: {
        message?: string;
      };
      statusCode?: number;
      response?: {
        status?: number;
      };
    };

    const backendMessage = fetchError.data?.message;
    if (backendMessage) {
      return backendMessage;
    }

    const status = fetchError.statusCode ?? fetchError.response?.status;
    if (status === 401) {
      return 'Invalid email or password';
    }

    return 'Unable to login. Please try again.';
  }

  async function login(email: string, password: string, redirect?: string) {
    try {
      loading.value = true;
      errorMessage.value = null;

      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      if (!response.success) {
        throw new Error('Login failed');
      }

      await session.fetch();
      const redirectTarget = resolveSafeRedirect(redirect);
      navigateTo(redirectTarget ?? localePath('/'));
    }
    catch (error) {
      console.error('Login error:', error);
      errorMessage.value = resolveLoginErrorMessage(error);
    }
    finally {
      loading.value = false;
    }
  }

  function loginWithKu(redirect?: string) {
    loading.value = true;
    clearError();

    const redirectTarget = resolveSafeRedirect(redirect);
    if (redirectTarget) {
      return navigateTo(`/api/auth/ku/login?redirect=${encodeURIComponent(redirectTarget)}`, { external: true });
    }

    return navigateTo('/api/auth/ku/login', { external: true });
  }

  async function logout() {
    const isKuUser = session.user.value?.authProvider === 'ku-all-login';

    if (isKuUser) {
      return navigateTo('/api/auth/ku/logout', { external: true });
    }

    await session.clear();
    navigateTo(localePath('/login'));
  }

  function clearError() {
    errorMessage.value = null;
  }

  function can(permissionCode: string) {
    return session.user.value?.permissions.includes(permissionCode) ?? false;
  }

  function canAny(permissionCodes: string[]) {
    const userPermissions = session.user.value?.permissions ?? [];
    return permissionCodes.some(code => userPermissions.includes(code));
  }

  function hasRole(roleName: string) {
    return session.user.value?.currentRole === roleName;
  }

  return {
    session,
    loading,
    errorMessage,
    login,
    loginWithKu,
    logout,
    clearError,
    can,
    canAny,
    hasRole,
  };
});
