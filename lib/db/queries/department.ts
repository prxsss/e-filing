import type { SQL } from 'drizzle-orm';

import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '..';
import { departments, faculties, roles, userRoles, users } from '../schema';

type DepartmentListFilters = {
  search?: string;
  facultyId?: number;
};

function getDepartmentsWhere(filters: DepartmentListFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (typeof filters.facultyId === 'number' && Number.isFinite(filters.facultyId)) {
    conditions.push(eq(departments.facultyId, filters.facultyId));
  }

  const search = filters.search?.trim();
  if (search) {
    const keyword = `%${search}%`;
    conditions.push(
      or(
        ilike(departments.departmentCode, keyword),
        ilike(departments.nameEn, keyword),
        ilike(departments.nameTh, keyword),
        sql`exists (
          select 1
          from ${userRoles} ur
          join ${roles} r on ur.role_id = r.id
          join ${users} u on ur.user_id = u.id
          where ur.department_id = ${departments.id}
            and lower(r.name) in ('head of dept', 'head of the department', 'department head')
            and (
              concat_ws(' ', u.title_en, u.first_name_en, u.last_name_en) ilike ${keyword}
              or concat(u.title_th, u.first_name_th, ' ', u.last_name_th) ilike ${keyword}
            )
        )`,
      )!,
    );
  }

  return conditions.length > 0 ? and(...conditions)! : undefined;
}

export async function getDepartments({
  pageSize,
  offset,
  filters,
}: {
  pageSize: number;
  offset: number;
  filters?: DepartmentListFilters;
}) {
  const whereClause = getDepartmentsWhere(filters ?? {});

  const headOfDepartment = db
    .select({
      headOfDeptEn: sql<string>`concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})`.as('head_of_dept_en'),
      headOfDeptTh: sql<string>`concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`.as('head_of_dept_th'),
    })
    .from(userRoles)
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(users, eq(userRoles.userId, users.id))
    .where(
      and(
        eq(userRoles.departmentId, departments.id),
        sql`lower(${roles.name}) in ('head of dept', 'head of the department', 'department head')`,
      ),
    )
    .limit(1)
    .as('head_of_department');

  const departmentsListQuery = db.select({
    id: departments.id,
    departmentCode: departments.departmentCode,
    nameEn: departments.nameEn,
    nameTh: departments.nameTh,
    faculty: sql<{ id: number; nameEn: string; nameTh: string }>`json_build_object(
      'id', ${faculties.id},
      'nameEn', ${faculties.nameEn},
      'nameTh', ${faculties.nameTh}
    )`,
    headOfDeptEn: headOfDepartment.headOfDeptEn,
    headOfDeptTh: headOfDepartment.headOfDeptTh,
  })
    .from(departments)
    .leftJoin(faculties, eq(departments.facultyId, faculties.id))
    .leftJoinLateral(headOfDepartment, sql`true`)
    .orderBy(asc(departments.departmentCode))
    .limit(pageSize)
    .offset(offset);

  const departmentsTotalQuery = db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(departments);

  if (whereClause) {
    departmentsListQuery.where(whereClause);
    departmentsTotalQuery.where(whereClause);
  }

  const [rows, total] = await Promise.all([
    departmentsListQuery,
    departmentsTotalQuery.then(result => result[0]?.count ?? 0),
  ]);

  return { rows, total };
}

export async function createDepartment(data: {
  departmentCode: string;
  nameEn: string;
  nameTh: string;
  facultyId: number;
}) {
  const [department] = await db.insert(departments).values({
    departmentCode: data.departmentCode,
    nameEn: data.nameEn,
    nameTh: data.nameTh,
    facultyId: data.facultyId,
  }).returning();

  return department;
}

export async function getDepartmentById(id: number) {
  const [department] = await db.select().from(departments).where(eq(departments.id, id));
  return department;
}

export async function updateDepartmentById(
  id: number,
  data: {
    departmentCode: string;
    nameEn: string;
    nameTh: string;
    facultyId: number;
  },
) {
  const [department] = await db.update(departments)
    .set({
      departmentCode: data.departmentCode,
      nameEn: data.nameEn,
      nameTh: data.nameTh,
      facultyId: data.facultyId,
    })
    .where(eq(departments.id, id))
    .returning();

  return department;
}

export async function getDepartmentDependencyCounts(id: number) {
  const [linkedUserResult, roleAssignmentResult] = await Promise.all([
    db.select({ count: sql<number>`count(distinct ${userRoles.userId})` })
      .from(userRoles)
      .where(eq(userRoles.departmentId, id)),
    db.select({ count: sql<number>`count(*)` })
      .from(userRoles)
      .where(eq(userRoles.departmentId, id)),
  ]);

  return {
    linkedUserCount: Number(linkedUserResult[0]?.count ?? 0),
    roleAssignmentCount: Number(roleAssignmentResult[0]?.count ?? 0),
  };
}

export async function deleteDepartmentById(id: number) {
  const [deletedDepartment] = await db.delete(departments)
    .where(eq(departments.id, id))
    .returning({ id: departments.id });

  return deletedDepartment;
}
