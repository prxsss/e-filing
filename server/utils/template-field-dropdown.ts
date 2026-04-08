export type DropdownSourceTable = 'faculties' | 'departments' | 'roles' | 'users';

type DropdownSourceDefinition = {
  table: DropdownSourceTable;
  label: string;
  labelColumns: Array<{ key: string; label: string }>;
};

export const DROPDOWN_SOURCE_DEFINITIONS: DropdownSourceDefinition[] = [
  {
    table: 'faculties',
    label: 'Faculties',
    labelColumns: [
      { key: 'nameTh', label: 'Name (TH)' },
      { key: 'nameEn', label: 'Name (EN)' },
      { key: 'facultyCode', label: 'Faculty Code' },
    ],
  },
  {
    table: 'departments',
    label: 'Departments',
    labelColumns: [
      { key: 'nameTh', label: 'Name (TH)' },
      { key: 'nameEn', label: 'Name (EN)' },
      { key: 'departmentCode', label: 'Department Code' },
    ],
  },
  {
    table: 'roles',
    label: 'Roles',
    labelColumns: [
      { key: 'nameTh', label: 'Name (TH)' },
      { key: 'name', label: 'Name (EN)' },
    ],
  },
  {
    table: 'users',
    label: 'Users',
    labelColumns: [],
  },
];

export type DropdownConfig = {
  sourceTable: DropdownSourceTable;
  labelColumn?: string;
  roleId?: number;
  dataLabel?: string;
  valueColumn: 'id';
};

export function getDropdownSourceDefinition(table: unknown): DropdownSourceDefinition | null {
  const normalizedTable = String(table ?? '').trim() as DropdownSourceTable;
  return DROPDOWN_SOURCE_DEFINITIONS.find(definition => definition.table === normalizedTable) ?? null;
}

export function normalizeDropdownConfig(value: unknown): DropdownConfig | null {
  const source = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;

  const sourceTable = String(source?.sourceTable ?? source?.source_table ?? '').trim();
  const labelColumn = String(source?.labelColumn ?? source?.label_column ?? '').trim();
  const roleId = Number.parseInt(String(source?.roleId ?? source?.role_id ?? ''), 10);
  const dataLabel = String(source?.dataLabel ?? source?.data_label ?? '').trim();
  const definition = getDropdownSourceDefinition(sourceTable);

  if (!definition) {
    return null;
  }

  if (definition.table === 'users') {
    if (!Number.isFinite(roleId) || roleId <= 0) {
      return null;
    }

    return {
      sourceTable: definition.table,
      roleId,
      dataLabel: dataLabel || undefined,
      valueColumn: 'id',
    };
  }

  const hasAllowedColumn = definition.labelColumns.some(column => column.key === labelColumn);
  if (!hasAllowedColumn) {
    return null;
  }

  return {
    sourceTable: definition.table,
    labelColumn,
    valueColumn: 'id',
  };
}

export function serializeDropdownConfig(value: unknown): DropdownConfig | null {
  const normalized = normalizeDropdownConfig(value);
  if (!normalized) {
    return null;
  }

  return {
    sourceTable: normalized.sourceTable,
    labelColumn: normalized.labelColumn,
    roleId: normalized.roleId,
    dataLabel: normalized.dataLabel,
    valueColumn: 'id',
  };
}
