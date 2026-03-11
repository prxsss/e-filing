import { bigint, boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const requestTemplate = pgTable('request_template', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: text('name'),
  description: text('description'),
  version: text('version'),
  isActive: boolean('is_active'),
  createdBy: bigint('created_by', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  documentUrl: text('document_url'),
  placedFieldsData: jsonb('placed_fields_data'),
  signingFlowData: jsonb('signing_flow_data'),
});
