import { pgTable, serial, text } from 'drizzle-orm/pg-core';

export const faculties = pgTable('faculties', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});
