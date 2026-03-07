import { integer, pgTable, primaryKey, serial, text, varchar } from 'drizzle-orm/pg-core';

import { permissions } from './permission';

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  descriptionEn: text('description_en'),
  descriptionTh: text('description_th'),
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
