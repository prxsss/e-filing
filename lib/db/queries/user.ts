import { desc, eq, sql } from 'drizzle-orm';

import db from '..';
import { departments, faculties, roles, userRoles, users } from '../schema';

export async function getUsers({ pageSize, offset }: { pageSize: number; offset: number }) {
  const [rows, total] = await Promise.all([
    db
      .select({
        id: users.id,

        fullNameEn: sql<string>`
          concat(${users.firstNameEn}, ' ', ${users.lastNameEn})
        `,

        email: users.email,
        banned: users.banned,

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

        roles: sql<{ name: string; count: number }[]>`
          coalesce(
            (
              select json_agg(
                json_build_object(
                  'name', role_counts.name,
                  'count', role_counts.count
                )
              )
              from (
                select r.name, count(*) as count
                from ${userRoles} ur
                join ${roles} r on ur.role_id = r.id
                where ur.user_id = ${users.id}
                group by r.name
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
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.$count(users),
  ]);

  return { rows, total };
}

export async function getUserById(id: string) {
  return db
    .select({
      id: users.id,

      firstNameEn: users.firstNameEn,
      lastNameEn: users.lastNameEn,
      fullNameEn: sql<string>`
        concat(${users.firstNameEn}, ' ', ${users.lastNameEn})
      `,

      firstNameTh: users.firstNameTh,
      lastNameTh: users.lastNameTh,
      fullNameTh: sql<string>`
        concat(${users.firstNameTh}, ' ', ${users.lastNameTh})
      `,

      email: users.email,
      image: users.image,
      banned: users.banned,

      createdAt: users.createdAt,
      updatedAt: users.updatedAt,

      assignments: sql<{ role: string; faculty: { id: string; nameEn: string; nameTh: string } | null; department: { id: string; nameEn: string; nameTh: string } | null }[]>`
      coalesce(
        json_agg(
          jsonb_build_object(
            'role', ${roles.name},

            'faculty',
              CASE
                WHEN ${faculties.id} IS NULL THEN NULL
                ELSE jsonb_build_object(
                  'id', ${faculties.id},
                  'nameEn', ${faculties.nameEn},
                  'nameTh', ${faculties.nameTh}
                )
              END,

            'department',
              CASE
                WHEN ${departments.id} IS NULL THEN NULL
                ELSE jsonb_build_object(
                  'id', ${departments.id},
                  'nameEn', ${departments.nameEn},
                  'nameTh', ${departments.nameTh}
                )
              END
          )
        ) filter (where ${userRoles.id} is not null),
        '[]'
      )
    `,
    })
    .from(users)
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(faculties, eq(userRoles.facultyId, faculties.id))
    .leftJoin(departments, eq(userRoles.departmentId, departments.id))
    .where(eq(users.id, id))
    .groupBy(users.id)
    .then(results => results[0] || null);
}
