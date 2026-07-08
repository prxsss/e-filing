import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = resolve(rootDir, 'lib/db/schema/schema.ts');
const schema = readFileSync(schemaPath, 'utf8');

const checks = [
  {
    label: 'nanoid import',
    pattern: /import\s*\{\s*nanoid\s*\}\s*from\s*['"]nanoid['"];?/,
  },
  {
    label: 'users.id nanoid defaultFn',
    pattern: /export\s+const\s+users\s*=\s*pgTable\(\s*['"]users['"]\s*,\s*\{[\s\S]*?\bid\s*:\s*text\([^)]*\)\.primaryKey\(\)\.notNull\(\)\.\$defaultFn\(\s*\(\)\s*=>\s*nanoid\(\s*12\s*\)\s*\)/,
  },
];

const missingChecks = checks.filter(check => !check.pattern.test(schema));

if (missingChecks.length > 0) {
  console.error('Schema guard failed: drizzle runtime defaults are missing.');
  console.error(`Checked file: ${schemaPath}`);
  console.error(`Missing: ${missingChecks.map(check => check.label).join(', ')}`);
  console.error('Restore users.id to: text().primaryKey().notNull().$defaultFn(() => nanoid(12))');
  process.exitCode = 1;
}
