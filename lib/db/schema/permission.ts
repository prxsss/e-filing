import { bigint, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { users } from './auth';

export const permissions = pgTable('permissions', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  code: text('code').notNull().unique(),
  description: text('description'),
});

export const roles = pgTable('roles', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull(),
  description: text('description'),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: bigint('role_id', { mode: 'number' })
    .references(() => roles.id)
    .notNull(),
  permissionId: bigint('permission_id', { mode: 'number' })
    .references(() => permissions.id)
    .notNull(),
}, t => [
  primaryKey({ columns: [t.roleId, t.permissionId] }),
]);

export const userRoles = pgTable('user_roles', {
  userId: text('user_id')
    .references(() => users.id)
    .notNull(),
  roleId: bigint('role_id', { mode: 'number' })
    .references(() => roles.id)
    .notNull(),
}, t => [
  primaryKey({ columns: [t.userId, t.roleId] }),
]);
