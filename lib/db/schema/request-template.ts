import { bigint, boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const requestTemplate = pgTable('request_template', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: text('name'),
  description: text('description'),
  category: text('category'),
  version: text('version'),
  isActive: boolean('is_active'),
  createdBy: bigint('created_by', { mode: 'number' }),
  documentUrl: text('document_url'),
  documentWidth: integer('document_width'),
  documentHeight: integer('document_height'),
  placedFieldsData: jsonb('placed_fields_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
