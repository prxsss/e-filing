import { bigint, boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const notifications = pgTable('notifications', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: bigint('user_id', { mode: 'number' }),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  authUserId: text('auth_user_id'),
  isRead: boolean('is_read').default(false).notNull(),
});
