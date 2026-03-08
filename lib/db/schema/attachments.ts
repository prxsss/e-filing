import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { request } from './request';

export const attachments = pgTable('attachments', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).references(() => request.id),
  fileName: text('file_name'),
  fileUrl: text('file_url'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});
