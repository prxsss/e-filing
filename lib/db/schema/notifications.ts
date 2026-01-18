import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const notifications = pgTable('notifications', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: bigint('user_id', { mode: 'number' }),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
