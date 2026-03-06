import tailwindcss from '@tailwindcss/vite';

import env from './lib/env';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // ssr: false,

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    'nuxt-auth-utils',
  ],

  devtools: { enabled: true },
  css: ['./app/assets/css/main.css'],
  runtimeConfig: {
    session: {
      password: env.NUXT_SESSION_PASSWORD,
      name: 'e-filing-session',
      cookie: {
        // maxAge: 60 * 60 * 24 * 7, // 7 days
        maxAge: 60 * 60 * 24, // 1 day
        // maxAge: 60 * 60, // 1 hour
      },
    },
  },
  compatibilityDate: '2025-07-15',
  i18n: {
    defaultLocale: 'th',
    strategy: 'prefix_except_default',
    locales: [{
      code: 'en',
      name: 'English',
      file: 'en.json',
      icon: 'i-flag-us-4x3',
    }, {
      code: 'th',
      name: 'ไทย',
      file: 'th.json',
      icon: 'i-flag-th-4x3',
    }],
  },
  eslint: {
    config: {
      standalone: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
