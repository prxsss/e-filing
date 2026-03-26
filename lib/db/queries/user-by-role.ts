import { eq, sql } from 'drizzle-orm';

import db from '..';
import { userRoles, users } from '../schema';

export async function getUsersByRoleId(roleId: number) {
  return db
    .select({
      id: users.id,
      fullNameEn: sql<string>`concat_ws(' ', ${users.academicRankEn}, ${users.titleEn}, ${users.firstNameEn}, ' ', ${users.lastNameEn})`,
      fullNameTh: sql<string>`concat(${users.academicRankTh}, ${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`,
      email: users.email,
    })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .where(eq(userRoles.roleId, roleId));
}
