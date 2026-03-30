```markdown
# Database Documentation

## Overview

The "e-filing" application is configured to use a PostgreSQL database. Drizzle ORM (`drizzle-orm`) provides the primary interface for database interactions, with the `postgres` driver for direct connections. The schema is defined in `lib/db/schema/index.ts` and uses snake_case naming convention.

Drizzle Kit (`drizzle-kit`) manages migrations, configured via `drizzle.config.ts` to output to `./lib/db/migrations` and connect using the `DATABASE_URL` environment variable from `.env`.

Supabase (`@supabase/supabase-js`) is also integrated, configured with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. This is likely used for authentication (alongside `nuxt-auth-utils`) or realtime features (given `socket.io` dependencies), but operates separately from the Drizzle-managed schema unless sharing the same PostgreSQL instance.

No design philosophy is explicitly documented beyond the Drizzle configuration favoring type-safe queries and migrations.

## Schema Diagram

No schema definitions are provided in the analyzed files, preventing generation of an ASCII ER diagram. Relationships and structure are defined in `lib/db/schema/index.ts`.

## Tables/Collections

No specific tables, columns, types, constraints, primary keys, foreign keys, or indexes are defined in the provided codebase files. All schema details reside in `lib/db/schema/index.ts`, which exports definitions loaded by `drizzle.config.ts`.

## Relationships

No relationship details (e.g., foreign key constraints) are available in the provided files. These are specified within the schema in `lib/db/schema/index.ts`.

## Migrations

Migrations are managed using Drizzle Kit for PostgreSQL.

### Configuration (`drizzle.config.ts`)
- **Output directory**: `./lib/db/migrations`
- **Schema path**: `./lib/db/schema/index.ts`
- **Casing**: `snake_case`
- **Dialect**: `postgresql`
- **Connection**: `DATABASE_URL` (loaded from `.env` via `dotenv/config`)

### Usage
- Generate migrations: `npx drizzle-kit generate:pg`
- Push schema changes (development): `npx drizzle-kit push:pg`
- Apply migrations: Typically handled in application runtime via Drizzle ORM's migration utilities (e.g., in a server plugin or Nitro handler). No explicit migration scripts are present in `package.json`.

Migrations are not automatically run via npm scripts. The `postinstall` script runs `nuxt prepare`, which does not trigger migrations.

## Seeding

No seeding scripts, data population mechanisms, or test data utilities are present in the provided codebase files (e.g., no seed scripts in `package.json` or references in configs).
```

## Environment Variables

Relevant database-related variables from `.env.example`:

| Variable                  | Description                                      | Required |
|---------------------------|--------------------------------------------------|----------|
| `DATABASE_URL`            | PostgreSQL connection string for Drizzle.        | Yes     |
| `SUPABASE_URL`            | Supabase project URL.                            | Yes     |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for server-side access.| Yes     |

Ensure `.env` is created from `.env.example` and populated before running migrations or the application.