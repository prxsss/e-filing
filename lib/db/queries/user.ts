import { eq, sql } from 'drizzle-orm';

import db from '..';
import { faculties, roles, userRoles, users } from '../schema';

export async function getUsers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      institutionId: users.institutionId,
      faculty: faculties.name,
      status: users.status,
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
    name: users.name,
    email: users.email,
    institutionId: users.institutionId,
    status: users.status,
    roles: sql<string[]>`array_agg(
      jsonb_build_object(
            'id', ${roles.id},
            'name', ${roles.name}
        )
    )`,
    facultyId: users.facultyId,
    faculty: faculties.name,
    image: users.image,
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
