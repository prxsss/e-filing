import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { faculties } from './faculties';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  firstNameEn: text('first_name_en').notNull(),
  lastNameEn: text('last_name_en').notNull(),
  firstNameTh: text('first_name_th'),
  lastNameTh: text('last_name_th'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  passwordHash: text('password_hash').notNull(),
  facultyId: integer('faculty_id').references((): AnyPgColumn => faculties.id),
  image: text('image'),
  banned: boolean('banned').default(false).notNull(),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
});
