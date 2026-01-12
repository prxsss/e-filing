import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

	modules: ['@nuxt/eslint', '@nuxt/ui'],

	devtools: { enabled: true },
	css: ['./app/assets/css/main.css'],	compatibilityDate: '2025-07-15',
	vite: {
		plugins: [tailwindcss()],
	},
	eslint: {
		config: {
			stylistic: {
				semi: true,
				quotes: 'single',
				commaDangle: 'always-multiline',
				indent: 'tab',
			},
		},
	},
});
