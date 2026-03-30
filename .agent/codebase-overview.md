```markdown
# e-filing Codebase Overview

Rapid-lookup reference for AI assistants. Nuxt 3 app for electronic form filing, PDF templating, signing, admin/student workflows, Supabase backend.

## File Index
- **nuxt.config.ts**: Main Nuxt configuration (modules, runtime config, i18n).
- **app/app.vue**: Root Vue app layout with layouts/default.vue.
- **app/pages/index.vue**: Landing/dashboard page.
- **app/pages/login.vue**: User login page.
- **lib/db/schema/index.ts**: Drizzle ORM schema (users, requests, templates, etc.).
- **lib/supabase/client.ts**: Supabase client setup for auth/DB.
- **server/api/requests/*.ts**: Core API for form requests (CRUD, signing).
- **server/api/pdf-templates/*.ts**: PDF template management APIs.
- **app/composables/use-pdf-signing.js**: PDF signing logic (canvas, operations).
- **app/stores/auth.ts**: Pinia store for user auth state.
- **server/utils/build-filled-pdf-for-request.ts**: Generates filled PDFs from templates/requests.

## Directory Map
- **app/**: Nuxt client-side (Vue components, composables for PDF/canvas/signing, pages for auth/admin/student/signer, Pinia stores, types/utils).
- **drizzle.config.ts**: Drizzle ORM migration/config.
- **eslint.config.mjs**: ESLint flat config.
- **i18n/locales/**: Translations (en/th).
- **lib/**: Backend libs (db schema/queries/migrations, Supabase client, env validation).
- **public/**: Static assets (fonts, sample PDFs, uploads/filled-requests).
- **server/**: Nitro server (API routes for auth/users/requests/templates, middleware/plugins/services/utils like PDF building/email).
- **shared/**: Cross-side types/utils (auth, validation, callbacks).

## Entry Points
- **Client**: `app/app.vue` → `layouts/default.vue` → `pages/index.vue` (dashboard).
- **Server**: `server/api/` handlers (e.g., `/api/requests.post.ts`).
- **DB**: `lib/db/index.ts` (Drizzle client).
- **Auth**: `app/middleware/auth.global.ts` + Supabase.

## Key Functions/Composables
- `use-pdf-signing.js`: Handles signature capture, PDF signing ops.
- `use-pdf-operations.js`: PDF manipulation (fill fields, place elements).
- `use-pdf-form-builder.js`: Builds editable PDF forms from templates.
- `build-filled-pdf-for-request.ts`: Server-side PDF population for requests.
- `use-socket.ts`: Realtime notifications (signing workflow).
- Stores: `auth.ts` (user/session), `request-filters.ts` (UI filters).

## Dependencies
- **Nuxt 3/Vue 3**: App framework.
- **Supabase**: Auth, realtime DB.
- **Drizzle ORM**: Type-safe DB queries/migrations (PostgreSQL).
- **Socket.io**: Realtime signing notifications.
- **pdf-lib**: PDF form filling/signing (inferred from composables).
- **Pinia**: State management.
- **@nuxtjs/i18n**: Thai/English localization.
```

## Quick Notes
- Roles: admin/student/signer; permissions via `server/utils/permission.ts`.
- PDF Workflow: Templates → Fields → Fill/Sign → Requests → Filled PDFs.
- DB Entities: users, roles, departments, faculties, requests, templates, fields.