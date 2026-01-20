import { sql } from 'drizzle-orm';
import { bigint, boolean, foreignKey, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const attachments = pgTable('attachments', {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({ name: 'attachments_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestId: bigint('request_id', { mode: 'number' }),
  fileName: text('file_name'),
  fileUrl: text('file_url'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.requestId],
    foreignColumns: [request.id],
    name: 'attachments_request_id_fkey',
  }),
]);

export const request = pgTable('request', {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({ name: 'request_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  templateId: bigint('template_id', { mode: 'number' }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  createdBy: bigint('created_by', { mode: 'number' }),
  status: text(),
  submittedAt: timestamp('submitted_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({ name: 'notifications_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  userId: bigint('user_id', { mode: 'number' }),
  message: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({ name: 'audit_logs_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestId: bigint('request_id', { mode: 'number' }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  performedBy: bigint('performed_by', { mode: 'number' }),
  action: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const requestTemplate = pgTable('request_template', {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({ name: 'request_template_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  name: text(),
  description: text(),
  tag: text(),
  version: text(),
  isActive: boolean('is_active'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  createdBy: bigint('created_by', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const requestTemplateValues = pgTable('request_template_values', {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({ name: 'request_template_values_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestId: bigint('request_id', { mode: 'number' }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  fieldId: bigint('field_id', { mode: 'number' }),
  value: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.requestId],
    foreignColumns: [request.id],
    name: 'request_template_values_request_id_fkey',
  }),
]);

export const requestTemplateFields = pgTable('request_template_fields', {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({ name: 'request_template_fields_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  templateId: bigint('template_id', { mode: 'number' }),
  fieldName: text('field_name'),
  fieldType: text('field_type'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const signatureFlow = pgTable('signature_flow', {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({ name: 'signature_flow_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  requestId: bigint('request_id', { mode: 'number' }).generatedByDefaultAsIdentity({ name: 'signature_flow_request_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  signerId: bigint('signer_id', { mode: 'number' }).generatedByDefaultAsIdentity({ name: 'signature_flow_signer_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  order: bigint({ mode: 'number' }),
  status: text(),
  signedAt: timestamp('signed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const signatures = pgTable('signatures', {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({ name: 'signatures_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  userId: bigint('user_id', { mode: 'number' }),
  type: text(),
  data: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({ name: 'users_id_seq', startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  email: text(),
  fullName: text('full_name'),
  phoneNumber: text('phone_number'),
  role: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});
