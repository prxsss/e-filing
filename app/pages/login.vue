<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';

import * as z from 'zod';

type AuthFormProvider = {
  label: string;
  color: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral' | undefined;
  variant: 'link' | 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | undefined;
  size: 'md' | 'xs' | 'sm' | 'lg' | 'xl' | undefined;
  onClick: () => void;
};

definePageMeta({
  title: 'login',
  layout: false,
  public: true,
});

const { locale, locales, t, setLocale } = useI18n();
const localePath = useLocalePath();
const route = useRoute();

const authStore = useAuthStore();

const redirectPath = computed(() => {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';

  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('://')) {
    return null;
  }

  return redirect;
});

if (authStore.session.loggedIn) {
  navigateTo(redirectPath.value ?? localePath('/'), { replace: true });
}

const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: t('common.form.email'),
  required: true,
  size: 'xl',
}, {
  name: 'password',
  label: t('common.form.password'),
  type: 'password',
  required: true,
  size: 'xl',
}];

const showEmailPassword = ref(false);

const providers: AuthFormProvider[] = [{
  label: 'KU ALL-Login',
  color: 'primary',
  variant: 'solid',
  size: 'xl',
  onClick: () => authStore.loginWithKu(redirectPath.value ?? undefined),
}];

const schema = z.object({
  email: z.email(t('common.validation.invalidEmail')),
  password: z.string(t('common.validation.required', { field: t('common.form.password') })),
});

type Schema = z.output<typeof schema>;

const formState = reactive({
  email: '',
  password: '',
});

const displayFields = computed(() => {
  return showEmailPassword.value ? fields : [];
});

const authForm = useTemplateRef('authForm');

const languageItems = computed(() =>
  locales.value.map(l => ({
    name: l.name,
    code: l.code,
    icon: l.icon as string,
  })),
);

const selectedLanguageIcon = computed(() =>
  languageItems.value.find(l => l.code === locale.value)?.icon,
);

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  await authStore.login(payload.data.email, payload.data.password, redirectPath.value ?? undefined);
}

watch(() => [authForm.value?.state.email, authForm.value?.state.password], () => {
  authStore.clearError();
});
</script>

<template>
  <div class="relative min-h-screen flex flex-col items-center justify-center gap-4 p-4">
    <div class="absolute top-4 right-4">
      <USelect
        :model-value="locale"
        :items="languageItems"
        label-key="name"
        value-key="code"
        :icon="selectedLanguageIcon"
        @update:model-value="setLocale($event)"
      />
    </div>

    <UPageCard class="w-full max-w-md">
      <UAuthForm
        ref="authForm"
        v-model="formState"
        :schema="schema"
        :fields="displayFields"
        :submit="{ label: $t('auth.login.submit'), loading: authStore.loading, loadingIcon: 'i-lucide-loader', variant: 'subtle', size: 'xl' }"
        :providers
        :separator="t('auth.login.orContinueWith')"
        @submit="onSubmit"
      >
        <template #header>
          <KuSrcLogo class="h-auto w-75 mx-auto mb-4" />
        </template>
        <template #password-hint>
          <ULink :to="localePath('/auth/forgot-password')" class="text-primary font-medium">
            {{ $t('auth.login.forgotPassword') }}
          </ULink>
        </template>
        <template #validation>
          <UAlert v-if="authStore.errorMessage" color="error" variant="subtle" icon="i-lucide-info" :title="authStore.errorMessage" />
        </template>
        <template #footer>
          <div class="space-y-3">
            <div v-if="showEmailPassword" class="text-sm">
              {{ $t('auth.login.firstTime') }} <ULink :to="localePath('/auth/activate')" class="text-primary font-medium">
                {{ $t('auth.login.activateLink') }}
              </ULink>.
            </div>
            <button
              type="button"
              class="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
              @click="() => { showEmailPassword = !showEmailPassword; if (!showEmailPassword) { formState.email = ''; formState.password = ''; } }"
            >
              {{ showEmailPassword ? $t('auth.login.hideEmailPassword') || '← Back' : $t('auth.login.otherLoginOptions') || 'Other login options' }}
            </button>
          </div>
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
