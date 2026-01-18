import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const requestTemplateValues = pgTable('request_template_values', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }),
  fieldId: bigint('field_id', { mode: 'number' }),
  value: text('value'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
