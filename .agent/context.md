```markdown
# e-Filing Context

## Project Summary
e-Filing is a Nuxt.js web app for university (Kasetsart University - KU) electronic document requests. Users (students, signers, admins) create, fill, sign, and approve PDF-based forms with workflows, real-time notifications via Socket.io, role-based permissions, and email alerts. Supports Thai/English i18n, digital signatures, and PDF template building.

## Tech Stack
- **Framework**: Nuxt 4 (Vue 3, SSR/SSG)
- **State**: Pinia
- **UI**: @nuxt/ui, Tailwind CSS 4
- **DB/ORM**: Drizzle ORM (Postgres), Supabase
- **Auth**: nuxt-auth-utils + OpenID Connect (KU-AllLogin)
- **PDF**: pdf-lib, pdfjs-dist, fontkit (Thai fonts: Sarabun)
- **Real-time**: Socket.io
- **Other**: i18n (en/th), Zod validation, Nodemailer/Resend emails, PapaParse (CSV), Nuxt Charts
- **Dev**: ESLint (@antfu), Husky, Drizzle Kit, TSX

## Key Files (Read First)
- `nuxt.config.ts`: App config (modules, runtime, i18n).
- `lib/db/schema/index.ts`: DB models (users, requests, templates, etc.).
- `stores/auth.ts`: Global auth state.
- `server/api/requests/*.ts`: Core request CRUD/endpoints.
- `composables/use-pdf-*.js`: PDF form building/signing logic.
- `app/middleware/*.ts`: Auth/permission guards.
- `.env.example`: Required env vars (DB, Supabase, OIDC, email).
- `types/*.ts`: Shared TS types (user, faculty, etc.).

## Architecture
```
Client (Nuxt App)
├── Pages: index.vue (dashboard), admin/*, student/*, signer/*, auth/*
├── Components: form/field/* (PDF fields), signature-canvas.vue, table-pagination.vue
├── Composables: use-pdf-operations.js (core PDF logic), use-socket.ts, use-departments.ts
├── Stores: auth.ts (user/session), request-filters.ts
├── Layouts: default.vue (global shell)

Server (Nuxt Nitro)
├── api/*: Endpoints (requests, users, pdf-templates, preview-template-pdf.post.ts)
├── utils: build-filled-pdf-for-request.ts (PDF generation), permission.ts
├── services: sign-notification.service.ts (Socket.io)
├── plugins: socket.io.ts

DB (Postgres/Supabase): schema/index.ts (snake_case)
Shared: types/ku-all-callback.ts (OIDC), utils/formatters.ts
```
- MVC-like: Pages/components for UI, composables/stores for logic, server/api for data/PDF ops.
- Real-time: Socket.io for signing notifications.
- Middleware: Global auth (auth.global.ts), permissions (permission.ts).

## Patterns & Conventions
- **Naming**: CamelCase (JS/TS), snake_case (DB via Drizzle). Composables: `use-*.ts/js`.
- **Structure**: Nuxt conventions + folders by feature (admin/student/signer).
- **Validation**: Zod schemas in API/composables.
- **PDF Flow**: Templates → place-field.ts → use-pdf-form-builder.js → signature-canvas → server PDF build/sign.
- **Auth**: Sidebase/nuxt-auth-utils; roles/permissions via DB queries.
- **i18n**: `t('key')`; locales/en|th.
- **Types**: Strict TS; shared/*.d.ts for globals.

## Common Tasks
- **Run Dev**: `npm i && npm run dev` (localhost:3000).
- **Build/Preview**: `npm run build && npm run preview`.
- **DB Migrate**: `npx drizzle-kit generate:pg && npx drizzle-kit push:pg`.
- **Add Page**: `pages/new-page.vue`; auto-routes.
- **Add API**: `server/api/v1/resource.post.ts`; use `defineEventHandler`, Zod.
- **New Composable**: `composables/useNew.ts`; export functions.
- **PDF Feature**: Extend `use-pdf-operations.js` or `place-field.ts`.
- **Lint/Fix**: `npm run lint` / `npm run lint:fix`.
- **Env**: Copy `.env.example`; set OIDC/DB/email.

## Testing
- **Linting**: `npm run lint` (ESLint + format); Husky auto-runs on git commit.
- **No Unit/E2E**: Add Vitest/Jest via `nuxt test` module if needed.
- **Manual**: Dev server + Postman for APIs; check PDF previews/signatures.

## Important Notes
- **Env Gotchas**: DATABASE_URL required; OIDC endpoints for KU-AllLogin; EMAIL_PROVIDER (console/nodemailer/resend).
- **PDF Quirks**: Canvas ops (use-canvas-operations.js); Thai fonts in `public/fonts`; browser/server PDF diffs.
- **Socket.io**: Client `use-socket.ts`, server `plugins/socket.io.ts`; namespaces for notifications.
- **Permissions**: Server `utils/permission.ts`; client middleware checks.
- **Uploads**: `public/uploads/filled-requests` for signed PDFs.
- **Supabase**: Client `lib/supabase/client.ts`; service role for server.
- **Watch**: Drizzle casing='snake_case'; Nuxt 4 TS refs in tsconfig.json.
```

*(~350 lines; optimized for AI parsing: bullets, code blocks, hierarchy.)*