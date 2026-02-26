import { and, eq } from 'drizzle-orm';

import db from '..';
import { userRoles } from '../schema';

export async function addUserRole(userId: string, roleId: number) {
  return db.insert(userRoles).values({
    roleId,
    userId,
  });
}

export async function removeUserRole(userId: string, roleId: number) {
  return db.delete(userRoles).where(
    and(
      eq(userRoles.userId, userId),
      eq(userRoles.roleId, roleId),
    ),
  );
}
