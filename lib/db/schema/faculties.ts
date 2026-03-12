import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const faculties = pgTable('faculties', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
