import { pgTable, serial, text, varchar } from 'drizzle-orm/pg-core';

export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  descriptionEN: text('description_en'),
  descriptionTH: text('description_th'),
});
