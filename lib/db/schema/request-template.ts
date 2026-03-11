import { bigint, boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const requestTemplate = pgTable('request_template', {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: text(),
  description: text(),
  version: text(),
  isActive: boolean('is_active'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  createdBy: bigint('created_by', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  documentUrl: text('document_url'),
  placedFieldsData: jsonb('placed_fields_data'),
  signingFlowData: jsonb('signing_flow_data'),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  documentWidth: bigint('document_width', { mode: 'number' }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  documentHeight: bigint('document_height', { mode: 'number' }),
});
