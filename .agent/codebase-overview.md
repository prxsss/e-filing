```markdown
# e-Filing Codebase Overview

Rapid lookup for AI assistants. Nuxt 3 full-stack app for electronic document filing, PDF form building/signing, admin/student portals, Supabase backend.

## File Index
- **nuxt.config.ts**: Main Nuxt configuration (modules, runtime config, i18n).
- **app/app.vue**: Root Vue app layout with global providers.
- **app/app.config.ts**: Runtime app config (title, theme).
- **lib/db/index.ts**: Drizzle ORM setup and DB connection.
- **lib/supabase/client.ts**: Supabase client initialization.
- **server/api/requests/*.ts**: Core API for managing filing requests (CRUD, status).
- **server/utils/build-filled-pdf-for-request.ts**: Generates filled PDFs from templates.
- **app/composables/use-pdf-operations.js**: PDF manipulation (load, fill, sign).
- **app/stores/auth.ts**: Pinia store for user auth state.
- **app/middleware/auth.global.ts**: Global client auth guard.

## Directory Map
- **app/**: Client-side Nuxt (pages, components, composables, stores, utils, types).
- **server/**: Nitro server (API routes, middleware, plugins like Socket.io, services).
- **lib/**: Shared libs (DB with Drizzle, Supabase client, env validation).
- **public/**: Static assets (fonts, sample PDFs, uploads dir for filled requests).
- **i18n/locales/**: Translations (en, th).
- **shared/**: Cross-side types/utils (auth, validation, callbacks).
- **db/** (under lib): Drizzle schema, migrations, queries.

## Entry Points
- **Client**: `app/app.vue` → pages (e.g., `index.vue`, `[...slug].vue`).
- **Server**: `server/api/` routes (e.g., `/api/requests`, `/api/pdf-templates`).
- **Config**: `nuxt.config.ts` → builds app/server.
- **DB**: `lib/db/index.ts` via Supabase/Drizzle.

## Key Functions/Classes
- **use-pdf-operations.js**: PDF load/fill/extract (core for forms).
- **use-pdf-signing.js**: Digital signing on canvas/PDF.
- **use-pdf-form-builder.js**: Builds editable PDF forms from templates.
- **build-filled-pdf-for-request.ts**: Merges data into PDF template for requests.
- **auth store (app/stores/auth.ts)**: Manages login, roles, permissions.
- **permission.ts (server/utils)**: Role-based access checks.
- **use-socket.ts**: Real-time notifications via Socket.io.

## Dependencies
- **Nuxt 3/Vue 3**: SSR framework.
- **Supabase**: Auth, DB (Postgres), storage.
- **Drizzle ORM**: Type-safe queries/migrations.
- **Pinia**: State management (auth, filters).
- **Socket.io**: Real-time signing/notifications.
- **pdf-lib/jsPDF**: PDF generation/filling/signing.
- **Zod**: Schema validation (env, forms).
```
```