import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const signatures = pgTable('signatures', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).notNull(),
  signatureFlowId: bigint('signature_flow_id', { mode: 'number' }),
  userId: text('user_id').notNull(),
  dataUrl: text('data_url').notNull(),
  fieldInstanceId: text('field_instance_id'),
  /** SHA-256 hex digest of the signed PDF bytes for tamper detection */
  pdfHash: text('pdf_hash'),
  /** Originating IP address for audit trail */
  ipAddress: text('ip_address'),
  /** User-agent string for audit trail */
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const signaturesOld = pgTable('signatures_old', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).notNull(),
  signatureFlowId: bigint('signature_flow_id', { mode: 'number' }),
  userId: text('user_id').notNull(),
  dataUrl: text('data_url').notNull(),
  fieldInstanceId: text('field_instance_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
