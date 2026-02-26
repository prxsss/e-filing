<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';

import * as z from 'zod';

definePageMeta({
  title: 'login',
  layout: false,
});

const { t } = useI18n();
const localePath = useLocalePath();

const authStore = useAuthStore();

const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: t('email'),
  placeholder: 'Enter your email',
  required: true,
}, {
  name: 'password',
  label: t('password'),
  type: 'password',
  placeholder: 'Enter your password',
  required: true,
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

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  await authStore.signIn(payload.data.email, payload.data.password);
}

watchEffect(() => {
  authStore.clearError();
});
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
    {{ formState.email }}
    {{ formState.password }}
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        v-model="formState"
        :schema="schema"
        :fields="fields"
        :submit="{ label: $t('login'), loading: authStore.loading, loadingIcon: 'i-lucide-loader' }"
        @submit="onSubmit"
      >
        <template #header>
          <SciKuSrcLogo :width="300" class="mx-auto" />
        </template>
        <template #validation>
          <UAlert v-if="authStore.errorMessage" color="error" icon="i-lucide-info" :title="authStore.errorMessage" />
        </template>
        <template #footer>
          <USeparator class="mb-4" />
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="link" :to="localePath('/')">
            {{ $t('backToHome') }}
          </UButton>
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
