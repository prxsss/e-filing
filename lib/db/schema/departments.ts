import { integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { faculties } from './faculties';

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  departmentCode: varchar('department_code', { length: 20 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  facultyId: integer('faculty_id').references(() => faculties.id).notNull(),
  headOfDeptId: text('head_of_dept_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
