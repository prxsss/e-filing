import { pgTable, serial, text, varchar } from 'drizzle-orm/pg-core';

export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  descriptionEn: text('description_en'),
  descriptionTh: text('description_th'),
});
