import { bigint, boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const requestTemplateFields = pgTable('request_template_fields', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  font: text('font'),
  fontSize: integer('font_size'),
  isFillable: boolean('is_fillable').default(true),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  icon: text('icon').notNull(),
  amount: integer('amount').default(1),
});
