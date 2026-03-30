```markdown
# Architecture Documentation: e-filing

## Overview

**e-filing** is a full-stack web application built with Nuxt 4 for electronic document filing and workflow management, primarily designed for Kasetsart University (KU). It enables users—such as students, signers (faculty/staff), and administrators—to create, submit, fill, sign, and approve PDF-based requests and forms digitally. Key features include:

- PDF form building and templating with dynamic fields.
- Electronic signatures via canvas capture.
- Request submission, tracking, and approval workflows.
- Real-time notifications via Socket.io.
- Role-based access control (RBAC) with permissions for admin, student, and signer roles.
- Multi-language support (Thai/English) and internationalization.
- Integration with KU-AllLogin for authentication via OpenID Connect (OIDC).
- Email notifications for workflow events.

The business purpose is to digitize paper-based filing processes, reducing manual handling, enabling remote signing/approval, and providing dashboards for monitoring requests across departments and faculties.

## Tech Stack

| Category          | Technology                  | Version          | Purpose |
|-------------------|-----------------------------|------------------|---------|
| Framework         | Nuxt                        | ^4.2.2          | Full-stack Vue.js meta-framework for SSR, routing, and API handling. |
| UI                | Vue                         | ^3.5.26         | Reactive UI components. |
| Styling           | TailwindCSS                 | ^4.2.1          | Utility-first CSS framework. |
| State Management  | Pinia                       | ^3.0.4          | Vue store for auth and filters. |
| ORM/Database      | Drizzle ORM                 | ^0.45.1         | Type-safe PostgreSQL queries/migrations. |
| Database          | PostgreSQL (via Supabase)   | N/A             | Relational data storage for users, requests, templates, etc. |
| Auth/DB Service   | Supabase                    | ^2.95.3         | Backend-as-a-service for auth, storage, and PostgreSQL hosting. |
| PDF Processing    | pdf-lib                     | ^1.17.1         | PDF form creation, signing, and manipulation. |
| PDF Fonts/Viewer  | @pdf-lib/fontkit, pdfjs-dist | ^1.1.1, ^5.4.530 | Font embedding (Sarabun Thai font) and PDF rendering. |
| Real-time         | Socket.io (client/server)   | ^4.8.3          | Live notifications and updates. |
| i18n              | @nuxtjs/i18n               | ^10.2.1         | Multi-language support (en/th). |
| Email             | nodemailer, resend          | ^8.0.3, ^6.9.4  | Transactional emails for notifications. |
| Utilities         | nanoid, zod, papaparse      | ^5.1.7, ^4.3.5, ^5.5.3 | ID generation, validation, CSV parsing. |
| TypeScript        | TypeScript (inferred)       | N/A             | Type safety across app/server/shared. |
| Dev Tools         | ESLint, Husky, drizzle-kit  | Various         | Linting, git hooks, DB migrations. |

## Project Structure

The monorepo follows Nuxt 4 conventions with clear separation of client-side (app/), server-side (server/), database (lib/db/), and shared utilities.

```
e-filing/
├── app/                          # Client-side Nuxt app (pages, components, composables)
│   ├── app.config.ts             # Global app config (e.g., title, theme)
│   ├── app.vue                   # Root app template
│   ├── assets/                   # Static assets (CSS, images)
│   ├── components/               # Reusable Vue components
│   │   ├── admin/, base/, field/, form/, template/  # Specialized components
│   │   ├── ku-logo.vue           # KU branding logo
│   │   ├── ku-src-logo.vue       # KU source logo variant
│   │   ├── notification-bell.vue # Real-time notification UI
│   │   ├── signature-canvas.vue  # Canvas for electronic signatures
│   │   └── table-pagination.vue  # Paginated tables
│   ├── composables/              # Vue composables for logic reuse
│   │   ├── use-canvas-operations.js, use-coordinate-conversion.js  # Canvas/PDF ops
│   │   ├── use-departments.ts, use-faculties.ts         # Faculty/dept data fetching
│   │   ├── use-document.js, use-pdf-operations.js       # Document/PDF handling
│   │   ├── use-pdf-form-builder.js, use-pdf-signing.js  # PDF form/signing logic
│   │   ├── use-pagination.js, use-socket.ts             # Pagination/real-time
│   │   └── user-users.ts                                # User management
│   ├── layouts/default.vue       # Default page layout
│   ├── middleware/               # Global/client middleware
│   │   ├── auth.global.ts        # Auth checks
│   │   ├── check-page-title.global.ts  # Dynamic page titles
│   │   ├── dashboard-redirect.ts # Route guards
│   │   └── permission.ts         # RBAC enforcement
│   ├── pages/                    # Auto-routed pages
│   │   ├── 403.vue               # Forbidden page
│   │   ├── admin/, auth/, signer/, student/  # Role-specific dashboards/pages
│   │   ├── index.vue, login.vue, profile.vue # Landing/auth/profile
│   ├── stores/                   # Pinia stores
│   │   ├── auth.ts               # Authentication state
│   │   └── request-filters.ts    # Request filtering state
│   ├── types/                    # TypeScript definitions
│   │   ├── department.ts, faculty.ts, template.ts, user.ts
│   └── utils/                    # Client utilities
│       ├── formatters.ts, place-field.ts, request-status.ts, etc.
├── drizzle.config.ts             # Drizzle migration config
├── i18n/locales/                 # Translation files (en/, th/)
├── lib/                          # Shared lib (DB, env, Supabase)
│   ├── db/                       # Drizzle setup
│   │   ├── index.ts              # DB connection
│   │   ├── migrations/           # Generated migrations
│   │   ├── queries/              # Reusable queries
│   │   └── schema/               # DB schema definitions
│   ├── env.ts                    # Env validation (Zod)
│   └── supabase/client.ts        # Supabase client init
├── nuxt.config.ts                # Nuxt configuration
├── public/                       # Static public assets
│   ├── General-Request.pdf       # Sample PDF template
│   ├── fonts/                    # Thai fonts (Sarabun)
│   ├── uploads/filled-requests/  # Uploaded PDFs
│   └── favicon.ico, robots.txt
├── server/                       # Server-side routes/plugins
│   ├── api/                      # Nitro API routes
│   │   ├── admin/, auth/, departments/, faculties/, notifications/, etc.
│   │   ├── pdf-templates/, preview-template-pdf.post.ts, upload-template-file.post.ts
│   │   ├── requests/, roles/, template-fields/, users/
│   ├── middleware/require-auth.ts # Server auth middleware
│   ├── plugins/socket.io.ts      # Socket.io server plugin
│   ├── services/sign-notification.service.ts # Notification service
│   └── utils/                    # Server utilities (PDF building, email, permissions)
├── shared/                       # Shared TypeScript types/utils (client/server)
│   ├── auth.d.ts, h3.d.ts        # H3/Supabase auth types
│   └── types/ku-all-callback.ts  # KU OIDC types
└── [config files: package.json, tsconfig.json, eslint.config.mjs]
```

## Architecture Diagram

```
+-------------------+     +-------------------+     +-------------------+
|   Browser/Client  |<--->|   Nuxt App (SSR)  |<--->|   Nitro Server    |
| - Vue Components  |     | - Pages/Layouts   |     | - API Routes      |
| - Composables     |     | - Pinia Stores    |     | - Middleware      |
| - Socket.io Client|     | - Middleware      |     | - Socket.io Server|
+-------------------+     +-------------------+     +-------------------+
         |                         |                         |
         v                         v                         v
+-------------------+     +-------------------+     +-------------------+
|   Supabase Auth   |<--->|   PostgreSQL DB   |<--->|   Email/SMS       |
| (KU-AllLogin OIDC)|     | (Drizzle ORM)     |     | (Nodemailer/Resend)|
+-------------------+     +-------------------+     +-------------------+
         ^                         ^                         ^
         |                         |                         |
      Real-time                  Schema/Queries           Notifications
      (Socket.io)              (lib/db/)               (sign-notification.service)
```

- **Client** ↔ **Nuxt App**: Vue rendering, composables for PDF/canvas ops.
- **Nuxt App** ↔ **Server**: API calls, Socket.io for live updates.
- **Server** ↔ **DB**: Drizzle queries for users/requests/templates.
- **Real-time**: Socket.io broadcasts notifications (e.g., new signatures).
- **PDF Flow**: Client builds/signs PDFs → Server generates filled PDFs → Public storage.

## Key Components

| Component/Module              | Location              | Description |
|-------------------------------|-----------------------|-------------|
| `signature-canvas.vue`        | `app/components/`     | Canvas component for capturing electronic signatures, integrated with `use-pdf-signing.js`. |
| `notification-bell.vue`       | `app/components/`     | UI for real-time notifications, powered by `use-socket.ts`. |
| `table-pagination.vue`        | `app/components/`     | Reusable paginated table with `use-pagination.js`. |
| `ku-logo.vue` / `ku-src-logo.vue` | `app/components/`  | KU branding logos. |
| `use-pdf-signing.js`          | `app/composables/`    | Composable for embedding signatures into PDFs using pdf-lib. |
| `use-pdf-form-builder.js`     | `app/composables/`    | Builds dynamic PDF forms from templates/fields. |
| `auth.ts` (Pinia)             | `app/stores/`         | Manages user sessions, integrated with Supabase/NUXT_AUTH_UTILS. |
| API Routes (e.g., `requests/`, `pdf-templates/`) | `server/api/` | CRUD for requests, templates, users; PDF preview/upload endpoints. |
| Socket.io Plugin              | `server/plugins/`     | Handles real-time events like sign notifications. |
| DB Schema                     | `lib/db/schema/`      | Defines tables for users, departments, faculties, requests, templates, fields. |

## Data Flow

1. **Authentication**: User logs in via KU-AllLogin OIDC → Supabase auth → Pinia `auth.ts` store → Global middleware enforces roles/permissions.
2. **Request Submission (Student)**: Select template → Fill fields via `use-pdf-form-builder.js` → Generate PDF → POST to `/api/requests/` → Store in DB → Socket.io/email notification to signers.
3. **PDF Signing (Signer)**: Fetch request → Load PDF → Draw signature on `signature-canvas.vue` → `use-pdf-signing.js` embeds sig → Upload signed PDF → Server `build-filled-pdf-for-request.ts` finalizes → Notify next approver.
4. **Admin Management**: Dashboards (`pages/admin/`) → API for users/roles/depts → Real-time updates via Socket.io.
5. **Notifications**: `sign-notification.service.ts` triggers Socket.io broadcasts and emails on events (e.g., new request).
6. **PDF Generation**: Templates from `public/` or uploads → Fields placed via `place-field.ts` → Filled via server utils → Stored in `public/uploads/filled-requests/`.

Data is type-safe (TypeScript/Zod/Drizzle), with RBAC via `permission.ts` utils.

## Configuration

- **nuxt.config.ts**: Configures modules (Pinia, UI, i18n, Tailwind, auth-utils), Socket.io, Supabase.
- **drizzle.config.ts**: PostgreSQL migrations with snake_case casing.
- **app.config.ts**: App metadata (title, i18n).
- **Environment Variables** (from `.env.example`):
  | Variable                  | Purpose |
  |---------------------------|---------|
  | `APP_URL`                 | Base URL for redirects/emails. |
  | `DATABASE_URL`            | PostgreSQL connection (Supabase). |
  | `SUPABASE_URL/KEY`        | Supabase project creds. |
  | `EMAIL_PROVIDER` (console/nodemailer/resend) | Email backend. |
  | `SMTP_*`, `RESEND_API_KEY`| SMTP/Resend config. |
  | `SCOPE`, `CLIENT_ID/SECRET`, `*_ENDPOINT`, `REDIRECT_URI` | KU-AllLogin OIDC. |
  | `NUXT_SESSION_PASSWORD`   | Session encryption. |
  | `IMPORT_USER_PASSWORD`    | Bulk user import. |

Load via `lib/env.ts` (Zod-validated).

## Dependencies

| Dependency          | Why Used |
|---------------------|----------|
| `nuxt-auth-utils`   | Simplifies Supabase/OIDC auth with sessions/RBAC. |
| `pdf-lib` / `@pdf-lib/fontkit` | Core PDF manipulation; Thai font support for forms/signing. |
| `socket.io`         | Real-time bidirectional comms for notifications without polling. |
| `drizzle-orm`       | Lightweight, type-safe ORM for PostgreSQL; auto-migrations. |
| `@nuxtjs/i18n`      | Seamless Vue i18n with locale switching (th/en). |
| `pinia`             | Lightweight state for auth/filters; Nuxt-integrated. |
| `nuxt-ui` / Tailwind | Pre-built components and styling for rapid UI dev. |
| `nodemailer` / `resend` | Reliable email delivery for workflow alerts. |
| `zod`               | Runtime schema validation for env/API payloads. |

All deps are production-ready; no unused packages noted.
```

## Local Development

Refer to `README.md` for setup (`npm install`, `npm run dev`). Run `drizzle-kit generate:pg` for migrations.