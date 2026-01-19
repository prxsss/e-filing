import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const attachments = pgTable('attachments', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }),
  fileName: text('file_name'),
  fileUrl: text('file_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
