import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { faculties } from './faculties';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  firstNameEN: text('first_name_en').notNull(),
  lastNameEN: text('last_name_en').notNull(),
  firstNameTH: text('first_name_th'),
  lastNameTH: text('last_name_th'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  passwordHash: text('password_hash').notNull(),
  facultyId: integer('faculty_id')
    .references(() => faculties.id),
  image: text('image'),
  banned: boolean('banned').default(false).notNull(),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
