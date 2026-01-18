<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';

import * as z from 'zod';

definePageMeta({
  layout: false,
});

const localePath = useLocalePath();

const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'Enter your email',
  required: true,
}, {
  name: 'password',
  label: 'Password',
  type: 'password',
  placeholder: 'Enter your password',
  required: true,
}];

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters'),
});

type Schema = z.output<typeof schema>;

function onSubmit(payload: FormSubmitEvent<Schema>) {
  console.log('Submitted', payload);
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        :fields="fields"
        :submit="{ label: 'Login' }"
        @submit="onSubmit"
      >
        <template #header>
          <SciKuSrcLogo :width="300" class="mx-auto" />
        </template>
        <template #footer>
          <USeparator class="mb-4" />
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="link" :to="localePath('/')">
            Back to Homepage
          </UButton>
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
