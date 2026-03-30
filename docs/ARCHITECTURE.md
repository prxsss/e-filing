# e-Filing Architecture

## Overview

e-Filing is a full-stack web application for electronic document filing and workflow management, primarily designed for institutional use (e.g., Kasetsart University - KU). It enables users to create, fill, sign, and track document requests using customizable PDF templates. Key features include:

- **Student workflows**: Submitting requests via fillable PDF forms.
- **Admin tools**: Managing departments, faculties, users, roles, permissions, templates, and requests.
- **Signer workflows**: Digital signing of documents with canvas-based signatures.
- **Real-time notifications**: Via Socket.io for updates on request status.
- **PDF operations**: Form building, filling, signing, and previewing using PDF-lib.
- **Multi-language support**: English (en) and Thai (th) via Nuxt i18n.
- **Authentication**: Integrated with KU-AllLogin (OpenID Connect) and Supabase.
- **Data management**: PostgreSQL via Supabase and Drizzle ORM.

The business purpose is to digitize paper-based filing processes, streamline approvals across departments/faculties, ensure secure digital signatures, and provide dashboards for tracking.

## Tech Stack

| Category          | Technology                  | Version          | Purpose |
|-------------------|-----------------------------|------------------|---------|
| Framework        | Nuxt                       | ^4.2.2          | Full-stack Vue framework for SSR, routing, and API routes. |
| UI Framework     | Vue                        | ^3.5.26         | Reactive UI components. |
| State Management | Pinia                      | ^3.0.4          | Client-side state store. |
| Styling          | TailwindCSS                | ^4.2.1          | Utility-first CSS. |
| ORM/Database     | Drizzle ORM                | ^0.45.1         | Type-safe PostgreSQL queries/migrations. |
| Database         | PostgreSQL (via Supabase)  | N/A             | Relational data storage. |
| Auth             | Supabase, nuxt-auth-utils  | ^2.95.3, ^0.5.29| User auth, sessions, OIDC integration. |
| Real-time        | Socket.io                  | ^4.8.3          | Live notifications and updates. |
| PDF Processing   | PDF-lib, @pdf-lib/fontkit  | ^1.17.1, ^1.1.1 | PDF form creation, filling, signing. |
| Internationalization | @nuxtjs/i18n            | ^10.2.1         | Multi-language support (en/th). |
| UI Components    | @nuxt/ui                   | ^4.5.0          | Pre-built UI elements. |
| Charts           | nuxt-charts                | ^2.1.3          | Data visualization (e.g., dashboards). |
| Email            | Nodemailer, Resend         | ^8.0.3, ^6.9.4  | Transactional emails. |
| Other            | TypeScript, Zod, Nanoid    | N/A             | Type safety, validation, ID generation. |

Additional tools: ESLint (^9.39.2), Husky (^9.1.7) for linting/git hooks; Drizzle Kit (^0.31.8) for migrations.

## Project Structure

The project follows Nuxt 4 conventions with a clear separation of client-side (app/), server-side (server/), database (lib/db/), and shared utilities.

```
e-filing/
├── app/                          # Nuxt app directory (client + hybrid)
│   ├── app.config.ts             # Runtime config
│   ├── app.vue                   # Root app component
│   ├── assets/                   # Static assets (CSS, images)
│   ├── components/               # Reusable Vue components
│   │   ├── admin/                # Admin-specific (e.g., dashboards)
│   │   ├── base/                 # Base UI components
│   │   ├── field/                # Form field components
│   │   ├── form/                 # Form-related components
│   │   ├── ku-logo.vue           # KU branding logo
│   │   ├── ku-src-logo.vue       # KU source logo
│   │   ├── notification-bell.vue # Real-time notification UI
│   │   ├── signature-canvas.vue  # Digital signature canvas
│   │   ├── table-pagination.vue  # Paginated tables
│   │   └── template/             # PDF template UI
│   ├── composables/              # Auto-imported composables
│   │   ├── use-canvas-operations.js  # Canvas ops for signatures
│   │   ├── use-coordinate-conversion.js # PDF coord conversion
│   │   ├── use-departments.ts    # Dept data fetching
│   │   ├── use-document.js       # Document handling
│   │   ├── use-faculties.ts      # Faculty data fetching
│   │   ├── use-pagination.js     # Pagination logic
│   │   ├── use-pdf-form-builder.js # PDF form building
│   │   ├── use-pdf-operations.js # General PDF ops
│   │   ├── use-pdf-signing.js    # PDF signing logic
│   │   ├── use-socket.ts         # Socket.io client
│   │   └── user-users.ts         # User management
│   ├── layouts/                  # Page layouts (default.vue)
│   ├── middleware/               # Global/client middleware
│   │   ├── auth.global.ts        # Auth checks
│   │   ├── check-page-title.global.ts # Dynamic titles
│   │   ├── dashboard-redirect.ts # Route guards
│   │   └── permission.ts         # Permission checks
│   ├── pages/                    # Auto-routed pages
│   │   ├── 403.vue / 404.vue     # Error pages
│   │   ├── [...slug].vue         # Dynamic catch-all
│   │   ├── admin/                # Admin pages
│   │   ├── auth/                 # Auth pages
│   │   ├── index.vue             # Home/dashboard
│   │   ├── login.vue             # Login page
│   │   ├── profile.vue           # User profile
│   │   ├── signer/               # Signer workflows
│   │   └── student/              # Student workflows
│   ├── stores/                   # Pinia stores
│   │   ├── auth.ts               # Auth state
│   │   └── request-filters.ts    # Request filtering
│   ├── types/                    # TypeScript types (dept, faculty, etc.)
│   └── utils/                    # Client utils (formatters, etc.)
├── drizzle.config.ts             # Drizzle migrations config
├── i18n/                         # i18n locales (en/th)
├── lib/                          # Server-side libs
│   ├── db/                       # Drizzle setup (schema, migrations, queries)
│   ├── env.ts                    # Env validation (Zod)
│   └── supabase/                 # Supabase client
├── public/                       # Static public assets
│   ├── General-Request.pdf       # Sample PDF template
│   ├── fonts/                    # Thai fonts (Sarabun)
│   └── uploads/filled-requests/  # Uploaded PDFs
├── server/                       # Server-only directory
│   ├── api/                      # API routes (admin, auth, requests, etc.)
│   ├── middleware/               # Server middleware (require-auth.ts)
│   ├── plugins/                  # Server plugins (socket.io.ts)
│   ├── services/                 # Services (sign-notification.service.ts)
│   └── utils/                    # Server utils (PDF building, email, permissions)
├── shared/                       # Shared types/utils (auth.d.ts, etc.)
├── nuxt.config.ts                # Nuxt config
├── package.json                  # Dependencies/scripts
├── tsconfig.json                 # TS config (references Nuxt-generated)
└── README.md                     # Setup instructions
```

## Architecture Diagram

```
+-------------------+     +-------------------+     +-------------------+
|     Browser       |     |   Nuxt App (SSR)  |     |   Server API      |
|                   |<--->| - Pages           |<--->| - /api/* routes   |
| - Vue Components  |     | - Composables     |     | - Middleware      |
| - Pinia Stores    |     | - Pinia           |     | - Plugins (Socket)|
| - Socket.io Client|     | - i18n/Tailwind   |     | - Services        |
+-------------------+     +-------------------+     +-------------------+
         |                         |                         |
         v                         v                         v
+-------------------+     +-------------------+     +-------------------+
|   Real-time       |<--->|   Supabase        |<--->|   PostgreSQL      |
|   (Socket.io)     |     |   (Auth/Storage)  |     |   (Drizzle ORM)   |
+-------------------+     +-------------------+     +-------------------+
         ^                         ^                         ^
         |                         |                         |
         +-------------------------+-------------------------+
                                 |
                           +-------------------+
                           |   PDF Ops         |
                           | (PDF-lib, Canvas) |
                           +-------------------+
```

- **Client**: Handles UI, state (Pinia), real-time (Socket client).
- **Nuxt Hybrid**: SSR pages, composables for PDF/signing ops.
- **Server**: API handlers, auth middleware, PDF utils, email/Socket server.
- **Data**: Supabase for auth/storage, PostgreSQL for schema (users, requests, templates).
- **Real-time**: Socket.io for notifications (e.g., sign requests).

## Key Components

| Component/Module          | Location              | Description |
|---------------------------|-----------------------|-------------|
| signature-canvas.vue     | app/components/      | Canvas for capturing digital signatures, integrated with PDF signing. |
| notification-bell.vue    | app/components/      | UI for real-time notifications via Socket.io. |
| table-pagination.vue     | app/components/      | Reusable paginated table component. |
| ku-logo.vue              | app/components/      | KU branding logo component. |
| Admin Components         | app/components/admin/| Dashboards, user/role management UIs. |
| Field Components         | app/components/field/| PDF form fields (e.g., text, signature). |
| Form Components          | app/components/form/ | Dynamic form builders for requests. |
| use-pdf-signing.js       | app/composables/     | Composable for embedding signatures into PDFs. |
| use-socket.ts            | app/composables/     | Socket.io client for live updates. |
| auth.ts                  | app/stores/          | Pinia store for user session/state. |
| schema/                  | lib/db/              | Drizzle schema for tables (users, requests, templates, etc.). |
| /api/requests/           | server/api/          | CRUD APIs for document requests. |
| build-filled-pdf-for-request.ts | server/utils/ | Server-side PDF filling from request data. |

## Data Flow

1. **Auth**: User logs in via `/login.vue` (Supabase/KU-AllLogin) → `stores/auth.ts` + middleware (`auth.global.ts`).
2. **Page Load**: Middleware checks permissions (`permission.ts`) → Fetch data via composables (e.g., `use-departments.ts` → `/api/departments`).
3. **Request Creation**: Student fills form (`form/*` components) → POST `/api/requests` → Server validates → Drizzle insert → Generate filled PDF (`build-filled-pdf-for-request.ts`).
4. **PDF Workflow**: Upload template (`/api/upload-template-file.post.ts`) → Place fields (`place-field.ts`) → Preview (`/api/preview-template-pdf.post.ts`).
5. **Signing**: Signer uses `signature-canvas.vue` + `use-pdf-signing.js` → POST signed PDF → Update request status → Socket emit notification.
6. **Notifications**: Server `sign-notification.service.ts` → Socket.io → Client `notification-bell.vue` + `use-socket.ts`.
7. **Dashboard**: Filters (`request-filters.ts`) → Paginated API (`use-pagination.js`) → Charts (`nuxt-charts`).
8. **Emails**: Status changes trigger Nodemailer/Resend via server utils.

Data is type-safe (TS/Zod/Drizzle), with real-time sync via Socket.io.

## Configuration

- **Environment Variables** (`.env` from `.env.example`):
  | Var                  | Purpose |
  |----------------------|---------|
  | APP_URL              | Base app URL. |
  | DATABASE_URL         | PostgreSQL connection. |
  | SUPABASE_URL/KEY     | Supabase project. |
  | EMAIL_PROVIDER       | 'console'/'nodemailer'/'resend'. |
  | SMTP_* / RESEND_*    | Email config. |
  | OIDC vars (SCOPE, CLIENT_ID, etc.) | KU-AllLogin integration. |

- **nuxt.config.ts**: Enables modules (`@pinia/nuxt`, `@nuxtjs/i18n`, etc.), Tailwind, UI.
- **drizzle.config.ts**: PostgreSQL dialect, snake_case, migrations to `lib/db/migrations`.
- **app.config.ts**: Runtime config (e.g., public/private keys).
- **i18n/locales/**: JSON files for en/th translations.

## Dependencies

| Dependency       | Why Used |
|------------------|----------|
| nuxt (^4.2.2)   | Core framework for SSR, file-based routing, API. |
| @supabase/supabase-js (^2.95.3) | Auth, realtime (falls back to Socket.io), storage for uploads. |
| drizzle-orm (^0.45.1) | Type-safe DB queries/migrations over raw PostgreSQL. |
| pdf-lib (^1.17.1) | Core PDF manipulation (forms, fonts, signing). |
| socket.io (^4.8.3) | Bidirectional real-time comms for notifications. |
| @nuxtjs/i18n (^10.2.1) | Locale switching (Thai fonts in public/). |
| pinia (^3.0.4)  | Reactive state across pages (auth, filters). |
| nuxt-auth-utils (^0.5.29) | Session management with Supabase/OIDC. |
| @nuxt/ui (^4.5.0) | Headless UI components (tables, modals). |
| nodemailer/resend | Outbound emails for request updates. |
| zod (^4.3.5)    | Runtime validation (env, APIs). |

All deps are ESM-compatible; no polyfills needed beyond canvas (^3.2.1) for Node PDF ops.