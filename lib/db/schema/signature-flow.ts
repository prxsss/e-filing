import { bigint, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const signatureFlow = pgTable('signature_flow', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).notNull(),
  stepId: text('step_id').notNull(),
  stepOrder: integer('step_order').notNull(),
  roleId: integer('role_id').notNull(),
  roleName: text('role_name').notNull(),
  assignedFieldInstanceIds: jsonb('assigned_field_instance_ids'),
  assignedUserId: text('assigned_user_id'),
  // 'waiting' | 'pending' | 'signed'
  status: text('status').notNull().default('waiting'),
  signedBy: text('signed_by'),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
