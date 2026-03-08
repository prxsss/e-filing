import { integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { roles } from './roles';

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
