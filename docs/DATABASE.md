# Database Documentation

## Overview

The "e-filing" application uses a **PostgreSQL** database, managed via **Drizzle ORM** (`drizzle-orm` and `postgres` dependencies). The schema is defined in TypeScript for type-safety and migrations are handled by **Drizzle Kit** (`drizzle-kit` dev dependency).

Design philosophy is not explicitly documented in the provided codebase. The setup emphasizes migrations in `snake_case` casing, with configuration driven by environment variables (primarily `DATABASE_URL`). Note that Supabase (`@supabase/supabase-js`) is also integrated (via `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.example`), suggesting potential use for authentication or as a PostgreSQL host, but Drizzle appears to be the primary ORM for custom schema management.

Detailed schema definitions (tables, columns, relationships) are referenced in `./lib/db/schema/index.ts` but not included in the provided codebase analysis. Refer to the source file for implementation specifics.

## Schema Diagram

No ASCII ER diagram can be generated, as table structures and relationships are not detailed in the provided files. The schema is exported from `./lib/db/schema/index.ts`.

## Tables/Collections

Table definitions are not present in the provided codebase excerpts. All schema details, including:

- Table names and purposes
- Columns/fields with types and constraints
- Primary keys and foreign keys
- Indexes

are defined in `./lib/db/schema/index.ts`. Use Drizzle ORM queries in the application code to interact with these tables.

## Relationships

Relationship details (e.g., foreign keys, joins) are defined within the schema in `./lib/db/schema/index.ts` but not available in the provided analysis.

## Migrations

Schema changes are managed using **Drizzle Kit**:

- Configuration: `./drizzle.config.ts`
  - Output directory: `./lib/db/migrations`
  - Schema path: `./lib/db/schema/index.ts`
  - Dialect: `postgresql`
  - Casing: `snake_case`
  - Database connection: `DATABASE_URL` from environment (loaded via `dotenv/config` and `./lib/env`)

To generate and apply migrations:

1. Ensure `DATABASE_URL` is set in `.env`.
2. Run `npx drizzle-kit generate:pg` (or equivalent via `drizzle-kit` CLI) to create migration files in `./lib/db/migrations`.
3. Apply migrations using Drizzle ORM in server code (e.g., via `db.push()` or custom migration scripts; implementation not shown in provided files).

The `postinstall` script runs `nuxt prepare`, which may integrate with TypeScript references including database types.

## Seeding

No seeding mechanisms (e.g., seed scripts, commands, or test data population) are documented or present in the provided codebase files. The `.env.example` includes `IMPORT_USER_PASSWORD=`, which may relate to user import/seeding processes, but details are unavailable.

For test data, manually query the database using Drizzle ORM or refer to application code (e.g., server routes or setup scripts) that might handle initialization. Supabase integration could also provide seeding via its dashboard if hosted there.