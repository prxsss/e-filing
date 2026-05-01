import type { SignRequestContext } from '~~/server/utils/email/types';

import db from '~~/lib/db';
import { departments, faculties, request, requestTemplate, signatureFlow, userRoles, users } from '~~/lib/db/schema';
import { count, eq, sql } from 'drizzle-orm';

export async function getSignRequestContext(requestId: number): Promise<SignRequestContext> {
  const [[req], [{ total }]] = await Promise.all([
    db
      .select({
        documentTitle: requestTemplate.name,
        studentNameTh: sql<string>`
          concat(${users.titleTh}, ${users.firstNameTh}, ' ', ${users.lastNameTh})
        `,
        studentNameEn: sql<string>`
          concat(${users.titleEn}, ${users.firstNameEn}, ' ', ${users.lastNameEn})
        `,
        studentEmail: users.email,
        studentId: users.id,
        facultyTh: faculties.nameTh,
        facultyEn: faculties.nameEn,
        departmentTh: departments.nameTh,
        departmentEn: departments.nameEn,
      })
      .from(request)
      .innerJoin(users, eq(request.userId, users.id))
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .innerJoin(faculties, eq(userRoles.facultyId, faculties.id))
      .innerJoin(departments, eq(userRoles.departmentId, departments.id))
      .innerJoin(requestTemplate, eq(request.templateId, requestTemplate.id))
      .where(eq(request.id, requestId))
      .limit(1),
    db
      .select({ total: count() })
      .from(signatureFlow)
      .where(eq(signatureFlow.requestId, requestId)),
  ]);

  return {
    requestId,
    studentName: req.studentNameTh,
    studentNameTh: req.studentNameTh,
    studentNameEn: req.studentNameEn,
    studentEmail: req.studentEmail,
    studentId: req.studentId,
    faculty: req.facultyTh,
    facultyTh: req.facultyTh,
    facultyEn: req.facultyEn,
    department: req.departmentTh,
    departmentTh: req.departmentTh,
    departmentEn: req.departmentEn,
    documentTitle: req.documentTitle!,
    totalSteps: total - 1, // total steps = total entries in signatureFlow - 1 (because the first entry is the requester)
  };
}
