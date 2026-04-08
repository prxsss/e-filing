import { asc } from 'drizzle-orm';

import db from '../../../lib/db/index';
import { getUsersByRoleId } from '../../../lib/db/queries/user-by-role';
import { departments, faculties, roles } from '../../../lib/db/schema';
import { getDropdownSourceDefinition } from '../../utils/template-field-dropdown';

function normalizeParam(value: unknown): string {
  return String(value ?? '').trim();
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const sourceTable = normalizeParam(query.table ?? query.sourceTable);
  const labelColumn = normalizeParam(query.labelColumn);
  const roleId = Number.parseInt(normalizeParam(query.roleId), 10);

  const sourceDefinition = getDropdownSourceDefinition(sourceTable);
  if (!sourceDefinition) {
    throw createError({
      statusCode: 400,
      message: 'Invalid dropdown table source',
    });
  }

  if (sourceDefinition.table !== 'users') {
    const isAllowedColumn = sourceDefinition.labelColumns.some(column => column.key === labelColumn);
    if (!isAllowedColumn) {
      throw createError({
        statusCode: 400,
        message: 'Invalid dropdown label column',
      });
    }
  }

  if (sourceDefinition.table === 'users') {
    if (!Number.isFinite(roleId) || roleId <= 0) {
      return {
        success: true,
        data: [],
      };
    }

    const users = await getUsersByRoleId(roleId);
    const rows = users.map(user => ({
      id: user.id,
      label: String(user.fullNameTh ?? user.fullNameEn ?? user.email ?? user.id),
    }));

    return {
      success: true,
      data: rows,
    };
  }

  if (sourceDefinition.table === 'faculties') {
    const rows = labelColumn === 'nameEn'
      ? await db.select({ id: faculties.id, label: faculties.nameEn }).from(faculties).orderBy(asc(faculties.nameEn))
      : (labelColumn === 'facultyCode'
          ? await db.select({ id: faculties.id, label: faculties.facultyCode }).from(faculties).orderBy(asc(faculties.facultyCode))
          : await db.select({ id: faculties.id, label: faculties.nameTh }).from(faculties).orderBy(asc(faculties.nameTh)));

    return { success: true, data: rows };
  }

  if (sourceDefinition.table === 'departments') {
    const rows = labelColumn === 'nameEn'
      ? await db.select({ id: departments.id, label: departments.nameEn }).from(departments).orderBy(asc(departments.nameEn))
      : (labelColumn === 'departmentCode'
          ? await db.select({ id: departments.id, label: departments.departmentCode }).from(departments).orderBy(asc(departments.departmentCode))
          : await db.select({ id: departments.id, label: departments.nameTh }).from(departments).orderBy(asc(departments.nameTh)));

    return { success: true, data: rows };
  }

  const rows = labelColumn === 'name'
    ? await db.select({ id: roles.id, label: roles.name }).from(roles).orderBy(asc(roles.name))
    : await db.select({ id: roles.id, label: roles.nameTh }).from(roles).orderBy(asc(roles.nameTh));

  return {
    success: true,
    data: rows,
  };
});
