import type { SQL } from 'drizzle-orm';

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '..';
import { departments, faculties, roles, userRoles, users } from '../schema';

type FacultyListFilters = {
  search?: string;
};

function getFacultiesWhere(filters: FacultyListFilters): SQL | undefined {
  const conditions: SQL[] = [];

  const search = filters.search?.trim();
  if (search) {
    const keyword = `%${search}%`;
    conditions.push(
      or(
        ilike(sql<string>`${faculties.id}::text`, keyword),
        ilike(faculties.nameEn, keyword),
        ilike(faculties.nameTh, keyword),
        sql`exists (
          select 1
          from ${userRoles} ur
          join ${roles} r on ur.role_id = r.id
          join ${users} u on ur.user_id = u.id
          where ur.faculty_id = ${faculties.id}
            and r.name = 'dean'
            and (
              concat(u.first_name_en, ' ', u.last_name_en) ilike ${keyword}
              or concat(u.first_name_th, ' ', u.last_name_th) ilike ${keyword}
            )
        )`,
      )!,
    );
  }

  return conditions.length > 0 ? and(...conditions)! : undefined;
}

export async function getFaculties({
  pageSize,
  offset,
  filters,
}: {
  pageSize: number;
  offset: number;
  filters?: FacultyListFilters;
}) {
  const whereClause = getFacultiesWhere(filters ?? {});

  const dean = db
    .select({
      deanNameEn: sql<string>`concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ' ', ${users.lastNameEn})`.as('dean_name_en'),
      deanNameTh: sql<string>`concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`.as('dean_name_th'),
    })
    .from(userRoles)
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(users, eq(userRoles.userId, users.id))
    .where(and(eq(userRoles.facultyId, faculties.id), eq(roles.name, 'dean')))
    .limit(1)
    .as('dean');

  const facultiesListQuery = db.select({
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
    .offset(offset);

  const facultiesTotalQuery = db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(faculties);

  if (whereClause) {
    facultiesListQuery.where(whereClause);
    facultiesTotalQuery.where(whereClause);
  }

  const [rows, total] = await Promise.all([
    facultiesListQuery,
    facultiesTotalQuery.then(result => result[0]?.count ?? 0),
  ]);

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
