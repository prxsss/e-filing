import type { SQL } from 'drizzle-orm';

import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';

import db from '..';
import { departments, faculties, request, roles, userRoles, users } from '../schema';

type UserListFilters = {
  search?: string;
  facultyId?: number | null;
  departmentId?: number | null;
  roleId?: number | null;
  status?: 'active' | 'banned' | 'inactive' | null;
};

function getUsersWhere(filters: UserListFilters): SQL | undefined {
  const conditions: SQL[] = [];

  const search = filters.search?.trim();
  if (search) {
    const keyword = `%${search}%`;
    conditions.push(
      or(
        ilike(users.studentId, keyword),
        ilike(users.staffId, keyword),
        ilike(users.email, keyword),
        ilike(sql<string>`concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})`, keyword),
        ilike(sql<string>`concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})`, keyword),
      )!,
    );
  }

  if (typeof filters.facultyId === 'number') {
    conditions.push(
      sql`exists (
        select 1
        from ${userRoles} ur
        where ur.user_id = ${users.id}
          and ur.faculty_id = ${filters.facultyId}
      )`,
    );
  }

  if (typeof filters.departmentId === 'number') {
    conditions.push(
      sql`exists (
        select 1
        from ${userRoles} ur
        where ur.user_id = ${users.id}
          and ur.department_id = ${filters.departmentId}
      )`,
    );
  }

  if (typeof filters.roleId === 'number') {
    conditions.push(
      sql`exists (
        select 1
        from ${userRoles} ur
        where ur.user_id = ${users.id}
          and ur.role_id = ${filters.roleId}
      )`,
    );
  }

  if (filters.status === 'active') {
    conditions.push(eq(users.banned, false));
    conditions.push(eq(users.isActive, true));
  }
  else if (filters.status === 'banned') {
    conditions.push(eq(users.banned, true));
  }
  else if (filters.status === 'inactive') {
    conditions.push(eq(users.banned, false));
    conditions.push(or(eq(users.isActive, false), isNull(users.isActive))!);
  }

  return conditions.length > 0 ? and(...conditions)! : undefined;
}

export async function getUsers({
  pageSize,
  offset,
  filters,
}: {
  pageSize: number;
  offset: number;
  filters?: UserListFilters;
}) {
  const whereClause = getUsersWhere(filters ?? {});

  const usersListQuery = db
    .select({
      id: users.id,
      studentId: users.studentId,
      staffId: users.staffId,

      fullNameEn: sql<string>`
          concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})
        `,

      fullNameTh: sql<string>`
          concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
        `,

      email: users.email,
      banned: users.banned,
      isActive: users.isActive,

      faculties: sql<{ nameEn: string; nameTh: string }[]>`
          coalesce(
            json_agg(
              distinct jsonb_build_object(
                'nameEn', ${faculties.nameEn},
                'nameTh', ${faculties.nameTh}
              )
            ) filter (where ${faculties.id} is not null),
            '[]'
          )
        `,

      roles: sql<{ name: string; nameTh: string; count: number }[]>`
          coalesce(
            (
              select json_agg(
                json_build_object(
                  'name', role_counts.name,
                  'nameTh', role_counts.name_th,
                  'count', role_counts.count
                )
                order by role_counts.first_user_role_id
              )
              from (
                select r.name, r.name_th, count(*) as count, min(ur.id) as first_user_role_id
                from ${userRoles} ur
                join ${roles} r on ur.role_id = r.id
                where ur.user_id = ${users.id}
                group by r.name, r.name_th
              ) role_counts
            ),
            '[]'
          )
        `,
    })
    .from(users)
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(faculties, eq(userRoles.facultyId, faculties.id))
    .groupBy(users.id)
    .orderBy(desc(users.updatedAt))
    .limit(pageSize)
    .offset(offset);

  const usersTotalQuery = db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(users);

  if (whereClause) {
    usersListQuery.where(whereClause);
    usersTotalQuery.where(whereClause);
  }

  const [rows, total] = await Promise.all([
    usersListQuery,
    usersTotalQuery.then(result => result[0]?.count ?? 0),
  ]);

  return { rows, total };
}

export async function getUserById(id: string) {
  return db
    .select({
      id: users.id,
      studentId: users.studentId,
      staffId: users.staffId,

      titleEn: users.titleEn,
      firstNameEn: users.firstNameEn,
      lastNameEn: users.lastNameEn,
      fullNameEn: sql<string>`
        concat_ws(' ', ${users.titleEn}, ${users.firstNameEn}, ${users.lastNameEn})
      `,

      titleTh: users.titleTh,
      firstNameTh: users.firstNameTh,
      lastNameTh: users.lastNameTh,
      fullNameTh: sql<string>`
        concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
      `,

      email: users.email,
      image: users.image,
      banned: users.banned,
      isActive: users.isActive,

      createdAt: users.createdAt,
      updatedAt: users.updatedAt,

      assignments: sql<{ role: string; faculty: { id: string; nameEn: string; nameTh: string } | null; department: { id: string; nameEn: string; nameTh: string } | null }[]>`
      coalesce(
        (
          select json_agg(
            jsonb_build_object(
              'role', r.name,
              'roleTh', r.name_th,
              'faculty',
                case
                  when f.id is null then null
                  else jsonb_build_object(
                    'id', f.id,
                    'nameEn', f.name_en,
                    'nameTh', f.name_th
                  )
                end,
              'department',
                case
                  when d.id is null then null
                  else jsonb_build_object(
                    'id', d.id,
                    'nameEn', d.name_en,
                    'nameTh', d.name_th
                  )
                end
            )
            order by ur.id
          )
          from ${userRoles} ur
          left join ${roles} r on ur.role_id = r.id
          left join ${faculties} f on ur.faculty_id = f.id
          left join ${departments} d on ur.department_id = d.id
          where ur.user_id = ${users.id}
        ),
        '[]'
      )
    `,
      totalRequests: sql<number>`count(${request.id})::int`,
      pendingRequests: sql<number>`count(case when ${request.status} in ('submitted', 'in_progress') then ${request.id} end)::int`,
      rejectedRequests: sql<number>`count(case when ${request.status} = 'rejected' then ${request.id} end)::int`,
      approvedRequests: sql<number>`count(case when ${request.status} = 'completed' then ${request.id} end)::int`,
    })
    .from(users)
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(faculties, eq(userRoles.facultyId, faculties.id))
    .leftJoin(departments, eq(userRoles.departmentId, departments.id))
    .leftJoin(request, eq(users.id, request.userId))
    .where(eq(users.id, id))
    .groupBy(users.id)
    .then(results => results[0] || null);
}
