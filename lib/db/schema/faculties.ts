import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';

export const faculties = pgTable('faculties', {
  id: serial('id').primaryKey(),
  facultyCode: varchar('faculty_code', { length: 20 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  deanId: text('dean_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
