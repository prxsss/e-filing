import { createAuthClient } from 'better-auth/vue';
import { defineStore } from 'pinia';

const authClient = createAuthClient();

export const useAuthStore = defineStore('auth', () => {
  const localePath = useLocalePath();

  const session = ref<Awaited<ReturnType<typeof authClient.useSession>> | null>(null);
  const errorMessage = ref<string | null>(null);
  const isSubmitting = ref(false);

  async function init() {
    const data = await authClient.useSession(useFetch);
    session.value = data;
  }

  const user = computed(() => session.value?.data?.user);
  const loading = computed(() => session.value?.isPending || isSubmitting.value);

  async function signIn(email: string, password: string) {
    errorMessage.value = null;
    isSubmitting.value = true;

    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: localePath('/'),
    });

    isSubmitting.value = false;

    if (error) {
      errorMessage.value = error.message || 'An error occurred';

      return false;
    }

    return true;
  }

  async function signOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigateTo(localePath('/login'));
        },
      },
    });
  }

  function clearError() {
    errorMessage.value = null;
  }

  return {
    errorMessage,
    user,
    loading,
    init,
    signIn,
    signOut,
    clearError,
  };
});
