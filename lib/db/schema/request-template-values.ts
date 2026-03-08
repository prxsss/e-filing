import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { request } from './request';

export const requestTemplateValues = pgTable('request_template_values', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).references(() => request.id),
  fieldId: bigint('field_id', { mode: 'number' }),
  value: text('value'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});
