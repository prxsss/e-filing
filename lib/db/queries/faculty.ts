import { and, desc, eq, sql } from 'drizzle-orm';

import db from '..';
import { departments, faculties, roles, userRoles, users } from '../schema';

export async function getFaculties({ pageSize, offset }: { pageSize: number; offset: number }) {
  const dean = db
    .select({
      deanNameEn: sql<string>`concat(${users.firstNameEn}, ' ', ${users.lastNameEn})`.as('dean_name_en'),
      deanNameTh: sql<string>`concat(${users.firstNameTh}, ' ', ${users.lastNameTh})`.as('dean_name_th'),
    })
    .from(userRoles)
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(users, eq(userRoles.userId, users.id))
    .where(and(eq(userRoles.facultyId, faculties.id), eq(roles.name, 'dean')))
    .limit(1)
    .as('dean');

  const [rows, total] = await Promise.all([
    db.select({
      id: faculties.id,
      facultyCode: faculties.facultyCode,
      nameEn: faculties.nameEn,
      nameTh: faculties.nameTh,
      departmentCount: sql<number>`count(${departments.id})`,
      deanNameEn: dean.deanNameEn,
      deanNameTh: dean.deanNameTh,
    })
      .from(faculties)
      .leftJoin(departments, eq(faculties.id, departments.facultyId))
      .leftJoinLateral(dean, sql`true`)
      .groupBy(faculties.id, dean.deanNameEn, dean.deanNameTh)
      .orderBy(desc(faculties.id))
      .limit(pageSize)
      .offset(offset),
    db.$count(faculties),
  ],
  );

  return { rows, total };
}

export async function createFaculty(data: {
  facultyCode: string;
  nameEn: string;
  nameTh: string;
}) {
  const [faculty] = await db.insert(faculties).values({
    facultyCode: data.facultyCode,
    nameEn: data.nameEn,
    nameTh: data.nameTh,
  }).returning();

  return faculty;
}

export async function getFacultyById(id: number) {
  const [faculty] = await db.select().from(faculties).where(eq(faculties.id, id));
  return faculty;
}

export async function updateFacultyById(
  id: number,
  data: {
    facultyCode: string;
    nameEn: string;
    nameTh: string;
  },
) {
  const [faculty] = await db.update(faculties)
    .set({
      facultyCode: data.facultyCode,
      nameEn: data.nameEn,
      nameTh: data.nameTh,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(faculties.id, id))
    .returning();

  return faculty;
}

export async function getFacultyDependencyCounts(id: number) {
  const [departmentResult, roleAssignmentResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(departments)
      .where(eq(departments.facultyId, id)),
    db.select({ count: sql<number>`count(*)` })
      .from(userRoles)
      .where(eq(userRoles.facultyId, id)),
  ]);

  return {
    departmentCount: Number(departmentResult[0]?.count ?? 0),
    roleAssignmentCount: Number(roleAssignmentResult[0]?.count ?? 0),
  };
}

export async function deleteFacultyById(id: number) {
  const [deletedFaculty] = await db.delete(faculties)
    .where(eq(faculties.id, id))
    .returning({ id: faculties.id });

  return deletedFaculty;
}
