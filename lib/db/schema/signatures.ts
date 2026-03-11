import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const signatures = pgTable('signatures', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).notNull(),
  signatureFlowId: bigint('signature_flow_id', { mode: 'number' }),
  userId: text('user_id').notNull(),
  fieldInstanceId: text('field_instance_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  pdfHash: text('pdf_hash'),
});
