```markdown
# e-filing Setup

This document provides comprehensive instructions for setting up, installing, and running the e-filing application. The project is built with Nuxt 4, Vue 3, TypeScript, Supabase, Drizzle ORM, PostgreSQL, Pinia, TailwindCSS, Socket.io, PDF-lib, and i18n.

## Prerequisites

- **Node.js**: v20.9.0 or higher (required for Nuxt 4 and dependencies like `tsx@^4.21.0` and `@types/node@^25.0.8`).
- **npm**: v10 or higher (project uses `npm` as the package manager).
- **PostgreSQL**: v12 or higher (via `postgres@^3.4.8` and Drizzle ORM for database operations).
- **Supabase Account**: Required for authentication and database hosting (using `@supabase/supabase-js@^2.95.3`).
- **Git**: For cloning the repository.
- **Optional**: OpenID Connect provider (e.g., KU-AllLogin) for authentication, SMTP server or Resend account for emails.

Ensure your environment meets these requirements before proceeding.

## Quick Start

1. Clone the repository: `git clone <repository-url> e-filing && cd e-filing`.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env.local` and configure required variables (e.g., `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NUXT_SESSION_PASSWORD`).
4. Set up the database: Run `npx drizzle-kit generate:pg` followed by `npx drizzle-kit push:pg` (or use Supabase dashboard for schema).
5. Start development server: `npm run dev`.

The app will be available at `http://localhost:3000`.

## Detailed Installation

### Clone Repository

```bash
git clone <repository-url> e-filing
cd e-filing
```

### Install Dependencies

The project uses npm as the package manager. Run:

```bash
npm install
```

This triggers the `postinstall` script (`nuxt prepare`) to set up Nuxt TypeScript references and prepares the project. Husky is installed via the `prepare` script for Git hooks.

### Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env.local
```

Edit `.env.local` with the following required variables (reference `.env.example` for all options):

- `APP_URL`: Base URL of the application (e.g., `http://localhost:3000`).
- `DATABASE_URL`: PostgreSQL connection string (e.g., from Supabase).
- `NUXT_SESSION_PASSWORD`: Secure password for session encryption (generate a strong 32+ character string).
- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key.
- `IMPORT_USER_PASSWORD`: Password for import user (if used).
- `EMAIL_PROVIDER`: Set to `console`, `nodemailer`, or `resend`.
  - For `resend`: Add `RESEND_API_KEY` and `EMAIL_FROM`.
  - For `nodemailer`: Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`.
- OpenID Connect (OIDC) for KU-AllLogin (optional): `SCOPE`, `CLIENT_SECRET`, `CLIENT_ID`, `REDIRECT_URI`, `LOGOUT_REDIRECT_URI`, `USER_INFO_ENDPOINT`, `AUTHORIZATION_ENDPOINT`, `TOKEN_ENDPOINT`, `END_SESSION_ENDPOINT`.

**Security Note**: Never commit `.env.local` to version control. Use `.env.local` for local development (Nuxt ignores it in production builds).

### Database Setup

1. Ensure `DATABASE_URL` points to a PostgreSQL instance (e.g., Supabase).
2. Install Drizzle Kit globally or use npx (included in devDependencies).
3. Generate migrations:
   ```bash
   npx drizzle-kit generate:pg
   ```
   Migrations are output to `./lib/db/migrations` (configured in `drizzle.config.ts`).
4. Apply migrations:
   ```bash
   npx drizzle-kit push:pg
   ```
   Alternatively, use `npx drizzle-kit migrate` after generating SQL files.

Schema is defined in `./lib/db/schema/index.ts` with snake_case casing for PostgreSQL.

## Running the Application

### Development Mode

Start the development server with hot module replacement:

```bash
npm run dev
```

Access the app at `http://localhost:3000`. TypeScript references are auto-generated in `.nuxt/tsconfig.*.json`.

### Production Mode

1. Build the app:
   ```bash
   npm run build
   ```
   This generates a production-ready `.output` directory.

2. Preview locally:
   ```bash
   npm run preview
   ```

For deployment, refer to [Nuxt deployment docs](https://nuxt.com/docs/getting-started/deployment). Static generation is available via `npm run generate`.

### With Docker

No Docker configuration is provided in the codebase.

## Running Tests

No test scripts or test suites are configured in `package.json`. Add testing (e.g., Vitest) as needed for your workflow.

Linting is available:
- `npm run lint`
- `npm run lint:fix`

Husky and lint-staged enforce linting on pre-commit.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `NUXT_SESSION_PASSWORD` errors | Generate a strong 32+ character random string (e.g., via `openssl rand -base64 32`). |
| Drizzle migration failures | Verify `DATABASE_URL` permissions and PostgreSQL connectivity. Run `npx drizzle-kit studio` for schema inspection. |
| Supabase auth issues | Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct; check Supabase dashboard for row-level security. |
| TailwindCSS styles missing | Restart dev server after Tailwind config changes; ensure `@tailwindcss/vite` is processed. |
| TypeScript errors | Run `npm run postinstall` or delete `.nuxt` and restart `npm run dev`. |
| Husky hooks not working | Run `npm run prepare` after `npm install`. |
| Email provider failures | Set `EMAIL_PROVIDER=console` for testing; verify SMTP/Resend credentials. |
| OIDC login loop | Confirm `REDIRECT_URI` matches `APP_URL` and OIDC endpoints. |

For persistent issues, check console logs or Supabase logs.

## IDE Setup

Recommended for VS Code:

- **TypeScript Importer** (built-in support via `tsconfig.json` references).
- **Tailwind CSS IntelliSense** (for TailwindCSS autocompletion).
- **ESLint** (via `@nuxt/eslint` and `@antfu/eslint-config`).
- **Volar** (official Vue 3 + TypeScript support for Nuxt/Vue).
- **Iconify IntelliSense** (for Heroicons/Lucide icons via `@iconify-json/*`).
- **Drizzle Studio** (run `npx drizzle-kit studio` for DB schema browsing).

Enable workspace TypeScript support in VS Code for full `.nuxt/tsconfig.*.json` integration.
```

## Deployment Notes

See [Nuxt deployment](https://nuxt.com/docs/getting-started/deployment) for platforms like Vercel, Netlify, or Node.js servers. Ensure environment variables are set in production.