import { eq, sql } from 'drizzle-orm';

import db from '..';
import { faculties, roles, userRoles, users } from '../schema';

export async function getUsers() {
  return db
    .select({
      id: users.id,
      fullNameEN: sql<string>`concat(${users.firstNameEN}, ' ', ${users.lastNameEN})`,
      fullNameTH: sql<string>`concat(${users.firstNameTH}, ' ', ${users.lastNameTH})`,
      email: users.email,
      faculty: faculties.name,
      banned: users.banned,
      roles: sql<string[]>`coalesce(array_agg(${roles.name}) filter (where ${roles.name} is not null), '{}')`,
    })
    .from(users)
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(faculties, eq(users.facultyId, faculties.id))
    .groupBy(users.id, faculties.name);
}

export async function getUserById(id: string) {
  return db.select({
    id: users.id,
    firstNameEN: users.firstNameEN,
    lastNameEN: users.lastNameEN,
    fullNameEN: sql<string>`concat(${users.firstNameEN}, ' ', ${users.lastNameEN})`,
    firstNameTH: users.firstNameTH,
    lastNameTH: users.lastNameTH,
    fullNameTH: sql<string>`concat(${users.firstNameTH}, ' ', ${users.lastNameTH})`,
    email: users.email,
    roles: sql<string[]>`array_agg(
      jsonb_build_object(
            'id', ${roles.id},
            'name', ${roles.name}
        )
    )`,
    facultyId: users.facultyId,
    facultyName: faculties.name,
    image: users.image,
    banned: users.banned,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  })
    .from(users)
    .where(eq(users.id, id))
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(faculties, eq(users.facultyId, faculties.id))
    .groupBy(users.id, faculties.name)
    .then(results => results[0] || null);
}
