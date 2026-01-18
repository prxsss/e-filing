import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const requestTemplateFields = pgTable('request_template_fields', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  templateId: bigint('template_id', { mode: 'number' }),
  fieldName: text('field_name'),
  fieldType: text('field_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
