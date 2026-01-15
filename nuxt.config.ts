import tailwindcss from '@tailwindcss/vite';

import './lib/env';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxtjs/i18n'],

  devtools: { enabled: true },
  css: ['./app/assets/css/main.css'],
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
