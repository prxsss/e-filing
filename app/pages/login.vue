<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';

import * as z from 'zod';

definePageMeta({
  title: 'login',
  layout: false,
  public: true,
});

const { t } = useI18n();
const localePath = useLocalePath();

const authStore = useAuthStore();

if (authStore.session.loggedIn) {
  navigateTo(localePath('/'), { replace: true });
}

const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: t('email'),
  placeholder: 'Enter your email',
  required: true,
  size: 'xl',
}, {
  name: 'password',
  label: t('password'),
  type: 'password',
  placeholder: 'Enter your password',
  required: true,
  size: 'xl',
}];

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters'),
});

type Schema = z.output<typeof schema>;

const formState = reactive({
  email: '',
  password: '',
});

const authForm = useTemplateRef('authForm');

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  await authStore.login(payload.data.email, payload.data.password);
}

watch(() => [authForm.value?.state.email, authForm.value?.state.password], () => {
  authStore.clearError();
});
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        ref="authForm"
        v-model="formState"
        :schema="schema"
        :fields="fields"
        :submit="{ label: $t('login'), loading: authStore.loading, loadingIcon: 'i-lucide-loader', size: 'xl' }"
        @submit="onSubmit"
      >
        <template #header>
          <KuSrcLogo class="h-auto w-75 mx-auto mb-4" />
        </template>
        <template #validation>
          <UAlert v-if="authStore.errorMessage" color="error" variant="subtle" icon="i-lucide-info" :title="authStore.errorMessage" />
        </template>
        <template #footer>
          First time logging in? <ULink :to="localePath('/auth/activate')" class="text-primary font-medium">
            Activate your account
          </ULink>.
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
