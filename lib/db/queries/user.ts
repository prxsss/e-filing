import { desc, eq, sql } from 'drizzle-orm';

import db from '..';
import { departments, faculties, roles, userRoles, users } from '../schema';

export async function getUsers({ pageSize, offset }: { pageSize: number; offset: number }) {
  const [rows, total] = await Promise.all([
    db
      .select({
        id: users.id,
        fullNameEn: sql<string>`concat(${users.firstNameEn}, ' ', ${users.lastNameEn})`,
        fullNameTh: sql<string>`concat(${users.firstNameTh}, ' ', ${users.lastNameTh})`,
        email: users.email,
        facultyId: sql<number>`min(${faculties.id})`,
        facultyNameEn: sql<string>`min(${faculties.nameEn})`,
        facultyNameTh: sql<string>`min(${faculties.nameTh})`,
        departmentId: sql<number>`min(${departments.id})`,
        departmentNameEn: sql<string>`min(${departments.nameEn})`,
        departmentNameTh: sql<string>`min(${departments.nameTh})`,
        banned: users.banned,
        roles: sql<string[]>`coalesce(array_agg(${roles.name}) filter (where ${roles.name} is not null), '{}')`,
      })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .leftJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(departments, eq(userRoles.departmentId, departments.id))
      .leftJoin(faculties, eq(userRoles.facultyId, faculties.id))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(users)
      .then(results => results[0]?.total ?? 0),
  ]);

  return { rows, total };
}

export async function getUserById(id: string) {
  return db.select({
    id: users.id,
    firstNameEn: users.firstNameEn,
    lastNameEn: users.lastNameEn,
    fullNameEn: sql<string>`concat(${users.firstNameEn}, ' ', ${users.lastNameEn})`,
    firstNameTh: users.firstNameTh,
    lastNameTh: users.lastNameTh,
    fullNameTh: sql<string>`concat(${users.firstNameTh}, ' ', ${users.lastNameTh})`,
    email: users.email,
    roles: sql<string[]>`array_agg(
      jsonb_build_object(
            'id', ${roles.id},
            'name', ${roles.name},
            'facultyId', ${userRoles.facultyId},
            'departmentId', ${userRoles.departmentId}
        )
    )`,
    facultyId: faculties.id,
    facultyNameEn: faculties.nameEn,
    facultyNameTh: faculties.nameTh,
    departmentsId: departments.id,
    departmentNameEn: departments.nameEn,
    departmentNameTh: departments.nameTh,
    image: users.image,
    banned: users.banned,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  })
    .from(users)
    .where(eq(users.id, id))
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(faculties, eq(departments.facultyId, faculties.id))
    .groupBy(
      users.id,
      faculties.id,
      departments.id,
    )
    .then(results => results[0] || null);
}
