import { bigint, foreignKey, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { request } from './request';
import { roles } from './roles';

export const signatureFlow = pgTable('signature_flow', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).notNull(),
  stepId: text('step_id').notNull(),
  stepOrder: integer('step_order').notNull(),
  roleId: integer('role_id').notNull(),
  roleName: text('role_name').notNull(),
  assignedFieldInstanceIds: jsonb('assigned_field_instance_ids'),
  status: text('status').notNull().default('waiting'),
  signedBy: text('signed_by'),
  signedAt: timestamp('signed_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  assignedUserId: text('assigned_user_id'),
}, t => [
  foreignKey({
    columns: [t.requestId],
    foreignColumns: [request.id],
    name: 'signature_flow_request_id_fkey',
  }),
  foreignKey({
    columns: [t.roleId],
    foreignColumns: [roles.id],
    name: 'signature_flow_role_id_fkey',
  }),
]);
