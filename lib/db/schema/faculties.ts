import { bigint, pgTable, text } from 'drizzle-orm/pg-core';

export const faculties = pgTable('faculties', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull(),
});
