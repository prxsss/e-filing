import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', () => {
  const localePath = useLocalePath();

  const session = useUserSession();
  const errorMessage = ref<string | null>(null);
  const loading = ref(false);

  function translate(key: string, fallback: string) {
    const nuxtApp = useNuxtApp() as {
      $i18n?: {
        t?: (messageKey: string) => unknown;
      };
    };

    const translated = nuxtApp.$i18n?.t?.(key);
    return typeof translated === 'string' ? translated : fallback;
  }

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
      switch (backendMessage) {
        case 'Invalid email or password':
          return translate('auth.login.errors.invalidCredentials', 'Invalid email or password');
        case 'Account is not activated.':
        case 'This account is not activated.':
          return translate('auth.login.errors.accountNotActivated', 'Account is not activated.');
        case 'Account is banned.':
          return translate('auth.login.errors.accountBanned', 'Account is banned.');
        case 'This email is registered with KU ALL-Login. Please sign in with KU ALL-Login method.':
          return translate('auth.login.errors.useKuAllLogin', 'This email is registered with KU ALL-Login. Please sign in with KU ALL-Login.');
        default:
          return backendMessage;
      }
    }

    const status = fetchError.statusCode ?? fetchError.response?.status;
    if (status === 401) {
      return translate('auth.login.errors.invalidCredentials', 'Invalid email or password');
    }

    return translate('auth.login.errors.unableToLogin', 'Unable to login. Please try again.');
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
  };
});
