import { integer, pgTable, primaryKey, serial, text, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';

export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: text('description'),
});

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: text('description'),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: integer('role_id')
    .references(() => roles.id)
    .notNull(),
  permissionId: integer('permission_id')
    .references(() => permissions.id)
    .notNull(),
}, t => [
  primaryKey({ columns: [t.roleId, t.permissionId] }),
]);

export const userRoles = pgTable('user_roles', {
  userId: text('user_id')
    .references(() => users.id)
    .notNull(),
  roleId: integer('role_id')
    .references(() => roles.id)
    .notNull(),
}, t => [
  primaryKey({ columns: [t.userId, t.roleId] }),
]);
