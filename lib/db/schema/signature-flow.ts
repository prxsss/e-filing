import { bigint, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const signatureFlow = pgTable('signature_flow', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).notNull(),
  stepId: text('step_id').notNull(),
  stepOrder: integer('step_order').notNull(),
  roleId: integer('role_id').notNull(),
  roleName: text('role_name').notNull(),
  assignedFieldInstanceIds: jsonb('assigned_field_instance_ids'),
  status: text('status').default('waiting').notNull(),
  signedBy: text('signed_by'),
  signedAt: timestamp('signed_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const signatureFlowOld = pgTable('signature_flow_old', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).notNull(),
  signerId: bigint('signer_id', { mode: 'number' }).notNull(),
  order: bigint('order', { mode: 'number' }),
  status: text('status'),
  signedAt: timestamp('signed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  signerUserId: text('signer_user_id'),
});
