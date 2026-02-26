import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', () => {
  const localePath = useLocalePath();

  const session = useUserSession();
  const errorMessage = ref<string | null>(null);
  const loading = ref(false);

  async function login(email: string, password: string) {
    try {
      loading.value = true;

      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      if (!response.success) {
        throw new Error('Login failed');
      }

      await session.fetch();
      navigateTo(localePath('/'));
    }
    catch (error) {
      console.error('Login error:', error);
      errorMessage.value = 'Invalid email or password';
    }
    finally {
      loading.value = false;
    }
  }

  async function logout() {
    await session.clear();
    navigateTo(localePath('/login'));
  }

  function clearError() {
    errorMessage.value = null;
  }

  return {
    session,
    loading,
    errorMessage,
    login,
    logout,
    clearError,
  };
});
