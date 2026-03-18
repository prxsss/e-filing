import { and, desc, eq, sql } from 'drizzle-orm';

import db from '..';
import { departments, faculties, roles, userRoles, users } from '../schema';

export async function getDepartments({
  pageSize,
  offset,
}: {
  pageSize: number;
  offset: number;
}) {
  const headOfDepartment = db
    .select({
      headOfDeptEn: sql<string>`concat(${users.firstNameEn}, ' ', ${users.lastNameEn})`.as('head_of_dept_en'),
      headOfDeptTh: sql<string>`concat(${users.firstNameTh}, ' ', ${users.lastNameTh})`.as('head_of_dept_th'),
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

  const [rows, total] = await Promise.all([
    db.select({
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
      .orderBy(desc(departments.id))
      .limit(pageSize)
      .offset(offset),
    db.$count(departments),
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
