import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const request = pgTable('request', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  templateId: bigint('template_id', { mode: 'number' }),
  createdBy: bigint('created_by', { mode: 'number' }),
  status: text('status'),
  submittedAt: timestamp('submitted_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  filledDocumentUrl: text('filled_document_url'),
  userId: text('user_id'),
  note: text('note'),
});
