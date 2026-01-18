import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const signatures = pgTable('signatures', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: bigint('user_id', { mode: 'number' }),
  type: text('type'),
  data: text('data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
