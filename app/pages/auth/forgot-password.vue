<script setup lang="ts">
import { reactive } from 'vue';

definePageMeta({
  title: 'forgotPassword',
  layout: false,
  public: true,
});

const { locale, locales, t, setLocale } = useI18n();
const localePath = useLocalePath();
const toast = useToast();

const authStore = useAuthStore();

if (authStore.session.loggedIn) {
  navigateTo(localePath('/'), { replace: true });
}

const loading = ref(false);
const otpLoading = ref(false);
const resendLoading = ref(false);
const error = ref('');
const successMessage = ref('');
const step = ref<1 | 2 | 3>(1);
const otpDigits = ref<string[]>([]);
const resendRemaining = ref(0);
const formState = reactive({
  email: '',
  otp: '',
  password: '',
  confirm: '',
});

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

const RESEND_COOLDOWN_SECONDS = 60;
let resendTimer: ReturnType<typeof setInterval> | null = null;

const canRequestOtp = computed(() => {
  const value = formState.email.trim();
  return value.includes('@') && value.includes('.') && !loading.value;
});

const canVerifyOtp = computed(() => {
  return formState.otp.trim().length === 6 && !otpLoading.value;
});

const canSetPassword = computed(() => {
  const hasPassword = formState.password.trim().length >= 8;
  const hasConfirm = formState.confirm.trim().length >= 8;
  return hasPassword && hasConfirm && !loading.value;
});

const canResendOtp = computed(() => {
  return step.value >= 2 && formState.email.trim() && resendRemaining.value === 0 && !resendLoading.value;
});

const resendLabel = computed(() => {
  if (resendRemaining.value > 0)
    return t('auth.forgot.form.resendIn', { seconds: resendRemaining.value });

  return t('auth.forgot.form.resendOtp');
});

function resolveForgotPasswordErrorMessage(errorValue: unknown, defaultKey: string) {
  const fetchError = errorValue as {
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
      case 'Email not found.':
        return t('auth.forgot.errors.emailNotFound');
      case 'This account is not activated.':
        return t('auth.forgot.errors.accountNotActivated');
      case 'Account is banned.':
        return t('auth.forgot.errors.accountBanned');
      case 'This account does not support password reset.':
      case 'This email is registered with KU ALL-Login. Please sign in with KU ALL-Login.':
        return t('auth.forgot.errors.passwordResetNotSupported');
      case 'Invalid or expired OTP.':
        return t('auth.forgot.errors.otpInvalid');
      case 'Please wait 1 minute before requesting a new OTP.':
        return t('auth.forgot.errors.resendCooldown');
      default:
        return backendMessage;
    }
  }

  const status = fetchError.statusCode ?? fetchError.response?.status;
  if (status === 404)
    return t('auth.forgot.errors.emailNotFound');
  if (status === 429)
    return t('auth.forgot.errors.resendCooldown');

  return t(defaultKey);
}

watch(otpDigits, (value) => {
  formState.otp = value.join('').replaceAll(' ', '').slice(0, 6);
}, { deep: true });

function resetError() {
  error.value = '';
}

function setStep(nextStep: 1 | 2 | 3) {
  step.value = nextStep;
  resetError();
}

function stopResendCooldown() {
  if (resendTimer) {
    clearInterval(resendTimer);
    resendTimer = null;
  }
}

function startResendCooldown(seconds = RESEND_COOLDOWN_SECONDS) {
  stopResendCooldown();
  resendRemaining.value = seconds;

  resendTimer = setInterval(() => {
    if (resendRemaining.value <= 1) {
      resendRemaining.value = 0;
      stopResendCooldown();
      return;
    }

    resendRemaining.value -= 1;
  }, 1000);
}

async function requestOtp() {
  if (!canRequestOtp.value)
    return;

  loading.value = true;
  resetError();
  successMessage.value = '';

  try {
    await $fetch('/api/auth/password/request-otp', {
      method: 'POST',
      body: { email: formState.email.trim() },
    });

    setStep(2);
    successMessage.value = t('auth.forgot.messages.otpSent');
    startResendCooldown();
  }
  catch (e: unknown) {
    error.value = resolveForgotPasswordErrorMessage(e, 'errors.general.description');
  }
  finally {
    loading.value = false;
  }
}

async function resendOtp() {
  if (!canResendOtp.value)
    return;

  resendLoading.value = true;
  resetError();
  successMessage.value = '';

  try {
    await $fetch('/api/auth/password/request-otp', {
      method: 'POST',
      body: { email: formState.email.trim() },
    });

    otpDigits.value = [];
    formState.otp = '';
    successMessage.value = t('auth.forgot.messages.resendSuccess');
    startResendCooldown();
  }
  catch (e: unknown) {
    error.value = resolveForgotPasswordErrorMessage(e, 'errors.general.description');
  }
  finally {
    resendLoading.value = false;
  }
}

async function verifyOtp() {
  if (!canVerifyOtp.value)
    return;

  otpLoading.value = true;
  resetError();
  successMessage.value = '';

  try {
    await $fetch('/api/auth/password/verify-otp', {
      method: 'POST',
      body: {
        email: formState.email.trim(),
        otp: formState.otp.trim(),
      },
    });

    setStep(3);
    successMessage.value = t('auth.forgot.messages.otpVerified');
  }
  catch (e: unknown) {
    error.value = resolveForgotPasswordErrorMessage(e, 'auth.forgot.errors.otpInvalid');
  }
  finally {
    otpLoading.value = false;
  }
}

async function resetPassword() {
  if (!canSetPassword.value)
    return;

  if (formState.password !== formState.confirm) {
    error.value = t('common.validation.mismatch', { field1: t('auth.forgot.form.newPasswordLabel'), field2: t('common.form.password') });
    return;
  }

  loading.value = true;
  resetError();
  successMessage.value = '';

  try {
    await $fetch('/api/auth/password/reset', {
      method: 'POST',
      body: {
        email: formState.email.trim(),
        otp: formState.otp.trim(),
        password: formState.password,
      },
    });

    toast.add({
      title: t('auth.forgot.messages.success'),
      color: 'success',
      icon: 'i-lucide-badge-check',
    });

    await navigateTo(localePath('/login'));
  }
  catch (e: unknown) {
    error.value = resolveForgotPasswordErrorMessage(e, 'errors.general.description');
  }
  finally {
    loading.value = false;
  }
}

onBeforeUnmount(() => {
  stopResendCooldown();
});
</script>

<template>
  <div class="relative min-h-screen flex flex-col items-center justify-center p-4">
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
      <div class="mb-10 flex justify-center">
        <KuSrcLogo class="h-auto w-72" />
      </div>

      <div class="mb-4 text-center">
        <h1 class="mb-3 text-2xl font-semibold text-slate-800">
          {{ $t('auth.forgot.title') }}
        </h1>
        <p class="mb-1 text-sm leading-relaxed text-slate-500">
          {{ $t('auth.forgot.description') }}
        </p>
      </div>

      <div class="mb-6 flex items-center justify-center gap-2 text-xs sm:text-sm">
        <UBadge :color="step >= 1 ? 'primary' : 'neutral'" variant="soft">
          1. {{ $t('auth.forgot.steps.requestOtp') }}
        </UBadge>
        <UBadge :color="step >= 2 ? 'primary' : 'neutral'" variant="soft">
          2. {{ $t('auth.forgot.steps.verifyOtp') }}
        </UBadge>
        <UBadge :color="step >= 3 ? 'primary' : 'neutral'" variant="soft">
          3. {{ $t('auth.forgot.steps.setPassword') }}
        </UBadge>
      </div>

      <UForm v-if="step === 1" class="space-y-6" :state="formState" @submit="requestOtp">
        <UFormField :label="$t('common.form.email')" name="email" required>
          <UInput
            v-model="formState.email"
            type="email"
            autocomplete="email"
            icon="i-lucide-mail"
            class="w-full"
            size="xl"
          />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          :title="error"
        />

        <UButton
          type="submit"
          :disabled="!canRequestOtp"
          :loading="loading"
          loading-icon="i-lucide-loader"
          size="xl"
          block
        >
          {{ $t('auth.forgot.form.getOtp') }}
        </UButton>

        <div class="text-center">
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="link" :to="localePath('/login')">
            {{ $t('common.actions.backTo', { page: $t('auth.login.title') }) }}
          </UButton>
        </div>
      </UForm>

      <UForm v-else-if="step === 2" class="space-y-6" :state="formState" @submit="verifyOtp">
        <UFormField :label="$t('auth.forgot.form.otpLabel')" name="otp" required>
          <UPinInput
            v-model="otpDigits"
            :length="6"
            otp
            class="w-full"
            size="xl"
          />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          :title="error"
        />

        <UButton
          type="submit"
          :disabled="!canVerifyOtp"
          :loading="otpLoading"
          loading-icon="i-lucide-loader"
          size="xl"
          block
        >
          {{ $t('auth.forgot.steps.verifyOtp') }}
        </UButton>

        <div class="flex items-center justify-between gap-2">
          <UButton
            type="button"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="link"
            :loading="resendLoading"
            :disabled="!canResendOtp"
            @click="resendOtp"
          >
            {{ resendLabel }}
          </UButton>
          <UButton type="button" icon="i-lucide-arrow-left" color="neutral" variant="link" @click="setStep(1)">
            {{ $t('auth.forgot.form.changeEmail') }}
          </UButton>
        </div>
      </UForm>

      <UForm v-else class="space-y-6" :state="formState" @submit="resetPassword">
        <UFormField :label="$t('common.form.email')" name="email">
          <UInput v-model="formState.email" disabled icon="i-lucide-mail" class="w-full" size="xl" />
        </UFormField>

        <UFormField :label="$t('auth.forgot.form.newPasswordLabel')" name="password" required :hint="$t('auth.forgot.form.passwordHint')">
          <UInput
            v-model="formState.password"
            type="password"
            autocomplete="new-password"
            icon="i-lucide-lock"
            class="w-full"
            size="xl"
          />
        </UFormField>

        <UFormField :label="$t('auth.forgot.form.confirmPassword')" name="confirm" required>
          <UInput
            v-model="formState.confirm"
            type="password"
            autocomplete="new-password"
            icon="i-lucide-shield-check"
            class="w-full"
            size="xl"
          />
        </UFormField>

        <UButton
          type="submit"
          :disabled="!canSetPassword"
          :loading="loading"
          loading-icon="i-lucide-loader"
          size="xl"
          block
        >
          {{ $t('auth.forgot.steps.setPassword') }}
        </UButton>
      </UForm>

      <UAlert
        v-if="successMessage"
        class="mt-4"
        color="success"
        variant="soft"
        icon="i-lucide-badge-check"
        :title="successMessage"
      />
    </UPageCard>
  </div>
</template>
