```markdown
# e-Filing Context

## Project Summary
e-Filing is a full-stack Nuxt app for electronic document filing, PDF form building, digital signing, and approval workflows at Kasetsart University (KU). Supports roles (admin, student, signer), real-time notifications via Socket.io, Supabase auth with OIDC (KU-AllLogin), and Thai/English i18n. Handles PDF templating, filling, signing with canvas, and email notifications.

## Tech Stack
- **Framework**: Nuxt 4 (SSR/SSG), Vue 3
- **UI/Styling**: @nuxt/ui, Tailwind CSS 4, Heroicons/Lucide icons
- **State**: Pinia
- **DB/ORM**: Drizzle ORM + PostgreSQL (via Supabase), snake_case schema
- **Auth**: nuxt-auth-utils, Supabase, OIDC (KU-AllLogin)
- **PDF**: pdf-lib, pdfjs-dist, fontkit (Sarabun Thai fonts), canvas for signing
- **Real-time**: Socket.io (client/server)
- **Other**: i18n (en/th), Nodemailer/Resend emails, Zod validation, PapaParse CSV
- **Dev**: ESLint (@antfu), Husky/Lint-staged, Drizzle-kit migrations

## Key Files (Read First)
- **Config**: `nuxt.config.ts`, `tsconfig.json`, `drizzle.config.ts`, `.env.example`
- **App Entry**: `app/app.vue`, `app/layouts/default.vue`
- **Stores**: `app/stores/auth.ts`, `app/stores/request-filters.ts`
- **Composables**: `app/composables/use-pdf-*.js/ts` (core PDF logic), `use-socket.ts`
- **API**: `server/api/` (e.g., `requests/`, `pdf-templates/`, `users/`)
- **DB**: `lib/db/schema/index.ts`, `lib/db/queries/`
- **Utils**: `app/utils/*`, `server/utils/build-filled-pdf-for-request.ts`
- **Types**: `app/types/*`, `shared/types/`
- **Middleware**: `app/middleware/*.global.ts`, `server/middleware/require-auth.ts`

## Architecture
```
Nuxt App (client/server hybrid)
├── app/          # Client-side: pages (admin/auth/student/signer), components (forms/signature/table), composables (PDF/pagination/socket), stores (auth/filters)
├── server/api/   # Server routes: auth/users/requests/templates (GET/POST handlers)
├── server/utils/ # PDF building, permissions, email
├── lib/db/       # Drizzle schema/queries/migrations
├── lib/supabase/ # Client
└── shared/       # Cross-side types/utils (e.g., auth.d.ts)
```
- **Flow**: Student submits request → PDF filled → Socket notify signers → Canvas sign → Admin approve → Email/DB update.
- **Pages**: Dynamic `[...slug].vue`, role-based (admin/student/signer).
- **Real-time**: Socket for sign notifications (`server/plugins/socket.io.ts`).

## Patterns & Conventions
- **Naming**: camelCase JS/TS, snake_case DB. Composables: `use-*.ts/js`. API: `endpoint.method.ts` (e.g., `requests.get.ts`).
- **Structure**: Composables for logic reuse (PDF ops heavy). Pinia for global state. Zod for validation.
- **Auth**: Global `auth.global.ts`, server `require-auth.ts`. Permissions via `server/utils/permission.ts`.
- **i18n**: `$t('key')`, locales in `i18n/locales/{en,th}`.
- **PDF**: `use-pdf-form-builder.js` for fields, `use-pdf-signing.js` for canvas ops. Fonts in `public/fonts/`.
- **Types**: Strict TS, shared types in `shared/`.

## Common Tasks
- **New Page**: Add `app/pages/new/[role/]page.vue`. Use `<UTable>`, `<UForm>`.
- **New API Route**: `server/api/v1/resource.method.ts`. Use `defineEventHandler`, `getUser()` (auth), Drizzle queries.
- **State**: `app/stores/new.ts` with Pinia `defineStore`.
- **DB Change**: Update `lib/db/schema/index.ts` → `npx drizzle-kit generate:pg` → `npx drizzle-kit push:pg`.
- **PDF Feature**: Extend `app/composables/use-pdf-*.js`, test with `preview-template-pdf.post.ts`.
- **Bug Fix**: `npm run lint:fix`, check console/DB logs, PDF canvas in devtools.
- **Build/Dev**: `npm run dev` (localhost:3000), `npm run build && npm run preview`.

## Testing
- No unit/E2E tests configured. Add Vitest/Jest via `nuxt test` module.
- Manual: Dev server + Postman for APIs, browser for PDF/signing.
- Lint: `npm run lint` (pre-commit via Husky).

## Important Notes
- **Env**: Set `DATABASE_URL`, `SUPABASE_*`, OIDC vars. `EMAIL_PROVIDER` (console/nodemailer/resend).
- **PDF Quirks**: Thai fonts (Sarabun) required; canvas ops browser-only. Use `use-coordinate-conversion.js` for scaling.
- **Sockets**: Client `use-socket.ts`, server plugin auto-connects.
- **Migrations**: Always `drizzle-kit push:pg` after schema changes (no down migrations).
- **Deployment**: SSR mode, set `APP_URL`. Supabase row-level security critical for prod.
- **Gotchas**: Nuxt 4 nitro caching (disable for dev APIs), OIDC logout redirects, large PDF uploads (tune limits).
```

*(298 lines total)*