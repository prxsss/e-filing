```markdown
# Setup Guide for e-filing

This document provides comprehensive instructions for setting up, installing, and running the e-filing application. The project is built with Nuxt 4, Vue 3, TypeScript, Supabase, Drizzle ORM, PostgreSQL, PDF-lib, Socket.io, Pinia, TailwindCSS, and i18n. It uses npm as the package manager.

## Prerequisites

Before setting up the project, ensure the following software is installed with at least the specified minimum versions:

| Software       | Minimum Version | Notes |
|----------------|-----------------|-------|
| Node.js       | 20.x            | Required for Nuxt 4 and TypeScript references. |
| npm           | 10.x            | Bundled with Node.js; used as the primary package manager. |
| PostgreSQL    | 12.x            | Accessed via `DATABASE_URL`; used with Drizzle ORM. |
| Supabase      | Account required| Project URL and service role key needed for authentication and storage. |
| Drizzle Kit   | Included (0.31.8)| Dev dependency for database migrations (`npx drizzle-kit`). |

- Git is recommended for cloning the repository.
- A code editor like VS Code is recommended (see [IDE Setup](#ide-setup) for extensions).

## Quick Start

Get the application running in 5 steps:

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd e-filing
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy and configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your values (e.g., DATABASE_URL, SUPABASE_URL)
   ```

4. Set up the database:
   ```bash
   npx drizzle-kit generate:pg
   npx drizzle-kit push:pg
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Detailed Installation

### Clone Repository

```bash
git clone <repository-url>
cd e-filing
```

### Install Dependencies

The project uses npm as the build system. Run:

```bash
npm install
```

This triggers the `postinstall` script (`nuxt prepare`) to set up Nuxt TypeScript configurations and generates `.nuxt/tsconfig.*.json` files referenced in `tsconfig.json`. Husky git hooks are installed via the `prepare` script.

### Environment Setup

Copy the example environment file and configure required variables:

```bash
cp .env.example .env
```

Edit `.env` with the following mandatory values (others depend on features like email or auth):

- `APP_URL`: Base URL of the application (e.g., `http://localhost:3000`).
- `DATABASE_URL`: PostgreSQL connection string (e.g., `postgres://user:pass@localhost:5432/dbname`).
- `NUXT_SESSION_PASSWORD`: Secure password for Nuxt sessions (generate a strong 32+ character string).
- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key.
- `IMPORT_USER_PASSWORD`: Password for import user (if using import features).

Optional/Feature-Specific:
- Email: `EMAIL_PROVIDER` (`console`, `nodemailer`, or `resend`), `EMAIL_FROM`, `RESEND_API_KEY`, SMTP vars (`SMTP_HOST`, etc.).
- OIDC (KU-AllLogin): `SCOPE`, `CLIENT_SECRET`, `CLIENT_ID`, `REDIRECT_URI`, etc.

Load environment variables via `dotenv/config` in `drizzle.config.ts` and other configs.

### Database Setup

The database uses Drizzle ORM with PostgreSQL (schema: `./lib/db/schema/index.ts`, migrations: `./lib/db/migrations`).

1. Ensure `DATABASE_URL` is set in `.env`.
2. Generate migrations:
   ```bash
   npx drizzle-kit generate:pg
   ```
3. Apply migrations (or use push for dev):
   ```bash
   npx drizzle-kit push:pg  # Non-destructive for dev
   # OR for production: npx drizzle-kit migrate
   ```

Drizzle config uses snake_case casing and connects via `DATABASE_URL`.

## Running the Application

### Development Mode

Start the Nuxt development server with hot module replacement:

```bash
npm run dev
```

Access at http://localhost:3000. TypeScript checks, ESLint, and TailwindCSS are configured automatically.

### Production Mode

1. Build the application:
   ```bash
   npm run build
   ```
   Outputs optimized assets to `.output` (server) or `.nuxt/dist` (static).

2. Preview locally:
   ```bash
   npm run preview
   ```

For deployment, refer to [Nuxt deployment docs](https://nuxt.com/docs/getting-started/deployment). Use `npm run generate` for static generation if needed.

### With Docker

No Docker configuration or Dockerfile is present in the codebase.

## Running Tests

No test suite or test scripts are configured in `package.json`. Add testing tools (e.g., Vitest) as needed.

## Troubleshooting

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| `nuxt prepare` fails | Missing Node 20+ | Upgrade Node.js. |
| Database connection error | Invalid `DATABASE_URL` | Verify PostgreSQL is running and URL format (e.g., `postgres://...`). Test with `psql`. |
| Supabase auth fails | Missing keys | Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` correctly. |
| TypeScript errors | Missing `.nuxt/tsconfig.*.json` | Run `npm install` to trigger `postinstall`. |
| ESLint/Husky issues | Git hooks not installed | Run `npm run prepare`. |
| Env vars not loaded | `.env` not in root | Ensure `.env` is copied and edited; restart server. |
| Migration fails | Schema changes | Run `npx drizzle-kit generate:pg` then `push:pg`. Check `drizzle.config.ts`. |
| TailwindCSS styles missing | Vite plugin issue | Ensure `@tailwindcss/vite` is processed; restart dev server. |

- Lint issues: `npm run lint` or `npm run lint:fix`.
- Clear Nuxt cache: Delete `.nuxt` and `node_modules/.cache`, then `npm install`.

## IDE Setup

Recommended for VS Code:

| Extension | Purpose |
|-----------|---------|
| Volar (Vue Language Features) | Vue 3/TypeScript support for Nuxt. Disable Vetur. |
| TypeScript Importer | Auto-imports for TS. |
| Tailwind CSS IntelliSense | Autocomplete/classes for TailwindCSS. |
| ESLint | Linting with `@antfu/eslint-config` and `eslint-plugin-format`. |
| Prettier | Code formatting (integrated via ESLint). |
| Iconify | IntelliSense for Heroicons/Lucide icons. |

Nuxt auto-generates TypeScript configs; restart TS server after `nuxt prepare`.
```

## Deployment Notes

- Ensure production `DATABASE_URL` uses a managed PostgreSQL (e.g., Supabase, Neon).
- Set `NUXT_SESSION_PASSWORD` securely (e.g., via secrets manager).