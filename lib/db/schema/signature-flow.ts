import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const signatureFlow = pgTable('signature_flow', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity(),
  signerId: bigint('signer_id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity(),
  order: bigint('order', { mode: 'number' }),
  status: text('status'),
  signedAt: timestamp('signed_at', { withTimezone: false }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
