import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  email: text('email'),
  fullName: text('full_name'),
  phoneNumber: text('phone_number'),
  role: text('role'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
