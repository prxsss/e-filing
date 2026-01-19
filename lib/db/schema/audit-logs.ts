import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }),
  performedBy: bigint('performed_by', { mode: 'number' }),
  action: text('action'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
