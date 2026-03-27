<script setup lang="ts">
import type { SelectItem, TableColumn } from '@nuxt/ui';
import type { ParseResult } from 'papaparse';

import Papa from 'papaparse';
import { h, resolveComponent } from 'vue';

type SystemFieldKey
  = | 'id'
    | 'title_en'
    | 'first_name_en'
    | 'last_name_en'
    | 'title_th'
    | 'first_name_th'
    | 'last_name_th'
    | 'email'
    | 'image'
    | 'role'
    | 'faculty'
    | 'department';

type CsvRecord = Record<string, string>;

type PreviewRow = {
  rowNumber: number;
  values: Record<SystemFieldKey, string>;
  emailValue: string;
  roleId: number | null;
  facultyId: number | null;
  departmentId: number | null;
  errors: string[];
};

type RoleApiItem = {
  id: number;
  name: string;
};

type FacultyApiItem = {
  id: number;
  facultyCode: string;
  nameEn: string;
  nameTh: string;
};

type DepartmentApiItem = {
  id: number;
  departmentCode: string;
  facultyId: number;
  nameEn: string;
  nameTh: string;
};

const emit = defineEmits<{
  imported: [];
}>();
const authStore = useAuthStore();
const toast = useToast();
const USelectMenu = resolveComponent('USelectMenu');
const UInput = resolveComponent('UInput');
const UFormField = resolveComponent('UFormField');
const systemFields: Array<{ key: SystemFieldKey; label: string; required: boolean }> = [
  { key: 'id', label: 'ID', required: true },
  { key: 'title_en', label: 'Title (EN)', required: false },
  { key: 'first_name_en', label: 'First Name (EN)', required: true },
  { key: 'last_name_en', label: 'Last Name (EN)', required: true },
  { key: 'title_th', label: 'Title (TH)', required: false },
  { key: 'first_name_th', label: 'First Name (TH)', required: true },
  { key: 'last_name_th', label: 'Last Name (TH)', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'image', label: 'Image URL', required: false },
  { key: 'role', label: 'Role', required: true },
  { key: 'faculty', label: 'Faculty', required: true },
  { key: 'department', label: 'Department', required: true },
];

const csvTemplateHeaders = systemFields.map(field => field.key).join(',');

const steps = ['Upload CSV', 'Column Mapping', 'Preview & Import', 'Complete'];
const currentStep = ref(1);
const isModalOpen = ref(false);

const uploadedFiles = ref<File | null>(null);
const csvHeaders = ref<string[]>([]);
const csvRows = ref<CsvRecord[]>([]);
const isParsing = ref(false);
const parseError = ref<string | null>(null);

const mapping = ref<Record<SystemFieldKey, string | null>>({
  id: null,
  title_en: null,
  first_name_en: null,
  last_name_en: null,
  title_th: null,
  first_name_th: null,
  last_name_th: null,
  email: null,
  image: null,
  role: null,
  faculty: null,
  department: null,
});

const showOnlyErrors = ref(false);

const currentPage = ref(1);
const itemsPerPage = ref(10);
const defaultRoleId = ref<number | null>(null);
const defaultFacultyId = ref<number | null>(null);
const defaultDepartmentId = ref<number | null>(null);
const isDefaultPanelCollapsed = ref(false);
const rowOverrides = ref<Record<number, {
  email: string | null;
  roleId: number | null;
  facultyId: number | null;
  departmentId: number | null;
}>>({});
const rowTouchedFields = ref<Record<number, {
  email: boolean;
  role: boolean;
  faculty: boolean;
  department: boolean;
}>>({});

const isImporting = ref(false);
const importResult = ref<{ success: number; failed: number; failedRows: string[] } | null>(null);

const { data: rolesData } = await useFetch<RoleApiItem[]>('/api/roles', { default: () => [] });
const { data: facultiesData } = await useFetch<FacultyApiItem[]>('/api/faculties', { default: () => [] });
const { data: departmentsData } = await useFetch<DepartmentApiItem[]>('/api/departments', { default: () => [] });

const roles = computed(() => rolesData.value ?? []);
const faculties = computed(() => facultiesData.value ?? []);
const departments = computed(() => departmentsData.value ?? []);

const roleItems = computed<SelectItem[]>(() => roles.value.map(role => ({
  label: role.name,
  value: role.id,
})));

const facultyItems = computed<SelectItem[]>(() => faculties.value.map(faculty => ({
  label: faculty.nameEn,
  value: faculty.id,
})));

const defaultDepartmentItems = computed<SelectItem[]>(() => {
  if (!defaultFacultyId.value) {
    return [];
  }

  const candidates = departments.value.filter(department => department.facultyId === defaultFacultyId.value);

  return candidates.map(department => ({
    label: department.nameEn,
    value: department.id,
  }));
});

const mappingSelectItems = computed<SelectItem[]>(() => [
  { label: 'Not mapped', value: '__unmapped__' },
  ...csvHeaders.value.map(header => ({ label: header, value: header })),
]);

const mappingErrors = computed(() => {
  const errors: string[] = [];
  const selectedColumns = Object.values(mapping.value).filter((value): value is string => Boolean(value));
  const duplicateColumns = selectedColumns.filter((column, index) => selectedColumns.indexOf(column) !== index);

  if (duplicateColumns.length > 0) {
    errors.push('Each CSV column can only be mapped once.');
  }

  for (const field of systemFields) {
    if (field.required && !mapping.value[field.key]) {
      errors.push(`${field.label} is required.`);
    }
  }

  return errors;
});

const previewRows = computed<PreviewRow[]>(() => {
  const roleLookup = new Map<string, RoleApiItem>();
  for (const role of roles.value) {
    roleLookup.set(normalize(role.name), role);
    roleLookup.set(String(role.id), role);
  }

  const facultyLookup = new Map<string, FacultyApiItem>();
  for (const faculty of faculties.value) {
    facultyLookup.set(String(faculty.id), faculty);
    facultyLookup.set(normalize(faculty.nameEn), faculty);
    facultyLookup.set(normalize(faculty.nameTh), faculty);
    facultyLookup.set(normalize(faculty.facultyCode), faculty);
  }

  const departmentLookup = new Map<string, DepartmentApiItem>();
  for (const department of departments.value) {
    departmentLookup.set(String(department.id), department);
    departmentLookup.set(normalize(department.nameEn), department);
    departmentLookup.set(normalize(department.nameTh), department);
    departmentLookup.set(normalize(department.departmentCode), department);
  }

  return csvRows.value.map((row, index) => {
    const values = {} as Record<SystemFieldKey, string>;

    for (const field of systemFields) {
      const mappedColumn = mapping.value[field.key];
      values[field.key] = mappedColumn ? String(row[mappedColumn] ?? '').trim() : '';
    }

    const errors: string[] = [];

    const roleFromRow = values.role ? roleLookup.get(normalize(values.role)) ?? roleLookup.get(values.role) : null;
    const defaultRole = defaultRoleId.value
      ? roles.value.find(role => role.id === defaultRoleId.value) ?? null
      : null;

    const faculty = values.faculty
      ? facultyLookup.get(normalize(values.faculty)) ?? facultyLookup.get(values.faculty)
      : null;

    const department = values.department
      ? departmentLookup.get(normalize(values.department)) ?? departmentLookup.get(values.department)
      : null;

    const resolvedRole = roleFromRow ?? defaultRole;
    const override = rowOverrides.value[index + 1];
    const finalEmail = (override?.email ?? values.email).trim();

    const defaultDepartment = defaultDepartmentId.value
      ? departments.value.find(item => item.id === defaultDepartmentId.value) ?? null
      : null;

    const finalRoleId = override?.roleId ?? resolvedRole?.id ?? null;
    const finalDepartmentId = override?.departmentId ?? department?.id ?? defaultDepartment?.id ?? null;
    const finalFacultyId = override?.facultyId ?? faculty?.id ?? defaultFacultyId.value ?? defaultDepartment?.facultyId ?? null;

    const finalRole = finalRoleId
      ? roles.value.find(role => role.id === finalRoleId) ?? null
      : null;
    const finalFaculty = finalFacultyId
      ? faculties.value.find(item => item.id === finalFacultyId) ?? null
      : null;
    const finalDepartment = finalDepartmentId
      ? departments.value.find(item => item.id === finalDepartmentId) ?? null
      : null;

    for (const field of systemFields) {
      if (['email', 'role', 'faculty', 'department'].includes(field.key)) {
        continue;
      }
      if (field.required && !values[field.key]) {
        errors.push(`Missing ${field.label}`);
      }
    }

    if (!finalEmail) {
      errors.push('Missing Email');
    }
    else if (!isValidEmail(finalEmail)) {
      errors.push('Invalid email format');
    }

    if (!finalRole) {
      errors.push('Role not found and no default role selected');
    }

    if (!finalFaculty) {
      errors.push('Faculty not found');
    }

    if (!finalDepartment) {
      errors.push('Department not found');
    }

    if (finalFaculty && finalDepartment && finalDepartment.facultyId !== finalFaculty.id) {
      errors.push('Department does not belong to selected faculty');
    }

    return {
      rowNumber: index + 1,
      values,
      emailValue: finalEmail,
      roleId: finalRole?.id ?? null,
      facultyId: finalFaculty?.id ?? null,
      departmentId: finalDepartment?.id ?? null,
      errors,
    };
  });
});

const filteredPreviewRows = computed(() => {
  return previewRows.value.filter((row) => {
    if (showOnlyErrors.value && row.errors.length === 0) {
      return false;
    }

    return true;
  });
});

const totalItems = computed(() => filteredPreviewRows.value.length);
const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredPreviewRows.value.slice(start, end);
});

const totalErrorRows = computed(() => previewRows.value.filter(row => row.errors.length > 0).length);
const validRows = computed(() => previewRows.value.filter(row => row.errors.length === 0));
const canImport = computed(() => validRows.value.length > 0 && !isImporting.value);

const tableColumns = computed<TableColumn<PreviewRow>[]>(() => {
  const columns: TableColumn<PreviewRow>[] = [
    {
      accessorKey: 'rowNumber',
      header: '#',
      cell: ({ row }) => String(row.original.rowNumber),
    },
  ];

  for (const field of systemFields) {
    if (field.key === 'email') {
      columns.push({
        id: field.key,
        header: field.label,
        cell: ({ row }) => {
          const current = row.original;
          const error = getFieldError(current, 'email');
          const showEditor = Boolean(error) || isFieldTouched(current.rowNumber, 'email');

          if (!showEditor) {
            return current.emailValue || '-';
          }

          return h(UFormField, { error, class: 'w-full' }, {
            default: () => h(UInput, {
              'modelValue': current.emailValue,
              'placeholder': 'Fix email',
              'size': 'sm',
              'class': 'w-full min-w-64',
              'onUpdate:modelValue': (value: string | number) => {
                setRowEmailOverride(current.rowNumber, String(value ?? ''));
              },
            }),
          });
        },
      });
      continue;
    }

    if (field.key === 'role') {
      columns.push({
        id: field.key,
        header: field.label,
        cell: ({ row }) => {
          const current = row.original;
          const shouldShowSelect = shouldKeepRoleEditor(current) || Boolean(getFieldError(current, 'role')) || isFieldTouched(current.rowNumber, 'role');

          if (!shouldShowSelect) {
            return wrapCellWithFieldError(current, 'role', getRoleDisplayValue(current));
          }

          return wrapCellWithFieldError(current, 'role', h(USelectMenu, {
            'modelValue': current.roleId,
            'items': roleItems.value,
            'valueKey': 'value',
            'placeholder': 'Select role',
            'onUpdate:modelValue': (value: string | number | null) => {
              setRowOverride(current.rowNumber, 'roleId', value ? Number(value) : null);
            },
          }));
        },
      });
      continue;
    }

    if (field.key === 'faculty') {
      columns.push({
        id: field.key,
        header: field.label,
        cell: ({ row }) => {
          const current = row.original;
          const shouldShowSelect = shouldKeepFacultyEditor(current) || Boolean(getFieldError(current, 'faculty')) || isFieldTouched(current.rowNumber, 'faculty');

          if (!shouldShowSelect) {
            return wrapCellWithFieldError(current, 'faculty', getFacultyDisplayValue(current));
          }

          return wrapCellWithFieldError(current, 'faculty', h(USelectMenu, {
            'modelValue': current.facultyId,
            'items': facultyItems.value,
            'valueKey': 'value',
            'placeholder': 'Select faculty',
            'onUpdate:modelValue': (value: string | number | null) => {
              setRowOverride(current.rowNumber, 'facultyId', value ? Number(value) : null);
            },
          }));
        },
      });
      continue;
    }

    if (field.key === 'department') {
      columns.push({
        id: field.key,
        header: field.label,
        cell: ({ row }) => {
          const current = row.original;
          const shouldShowSelect = shouldKeepDepartmentEditor(current) || Boolean(getFieldError(current, 'department')) || isFieldTouched(current.rowNumber, 'department');

          if (!shouldShowSelect) {
            return wrapCellWithFieldError(current, 'department', getDepartmentDisplayValue(current));
          }

          return wrapCellWithFieldError(current, 'department', h(USelectMenu, {
            'modelValue': current.departmentId,
            'items': getDepartmentItemsForRow(current),
            'valueKey': 'value',
            'placeholder': 'Select department',
            'onUpdate:modelValue': (value: string | number | null) => {
              setRowOverride(current.rowNumber, 'departmentId', value ? Number(value) : null);
            },
          }));
        },
      });
      continue;
    }

    columns.push({
      id: field.key,
      header: field.label,
      meta: {
        class: {
          th: 'min-w-44',
          td: 'min-w-44',
        },
      },
      cell: ({ row }) => wrapCellWithFieldError(row.original, field.key, row.original.values[field.key] || '-'),
    });
  }

  return columns;
});

const isFirstStep = computed(() => currentStep.value === 1);
const isMappingStep = computed(() => currentStep.value === 2);
const isPreviewStep = computed(() => currentStep.value === 3);
const isCompleteStep = computed(() => currentStep.value === 4);

const backButtonVisible = computed(() => !isFirstStep.value && !isCompleteStep.value);

watch([showOnlyErrors, itemsPerPage], () => {
  currentPage.value = 1;
}, { deep: true });

watch(defaultFacultyId, (facultyId) => {
  if (!defaultDepartmentId.value) {
    return;
  }

  const selectedDepartment = departments.value.find(item => item.id === defaultDepartmentId.value);
  if (!selectedDepartment) {
    defaultDepartmentId.value = null;
    return;
  }

  if (facultyId && selectedDepartment.facultyId !== facultyId) {
    defaultDepartmentId.value = null;
  }
});

watch(isModalOpen, (open) => {
  if (!open) {
    resetWizardState();
  }
});

function normalize(value: string) {
  return String(value ?? '').trim().toLowerCase();
}

function setRowOverride(
  rowNumber: number,
  key: 'roleId' | 'facultyId' | 'departmentId',
  value: number | null,
) {
  const current = rowOverrides.value[rowNumber] ?? {
    email: null,
    roleId: null,
    facultyId: null,
    departmentId: null,
  };

  rowOverrides.value = {
    ...rowOverrides.value,
    [rowNumber]: {
      ...current,
      [key]: value,
      ...(key === 'facultyId' ? { departmentId: null } : {}),
    },
  };

  markFieldTouched(
    rowNumber,
    key === 'roleId' ? 'role' : key === 'facultyId' ? 'faculty' : 'department',
  );
}

function setRowEmailOverride(rowNumber: number, value: string) {
  const current = rowOverrides.value[rowNumber] ?? {
    email: null,
    roleId: null,
    facultyId: null,
    departmentId: null,
  };

  rowOverrides.value = {
    ...rowOverrides.value,
    [rowNumber]: {
      ...current,
      email: value,
    },
  };

  markFieldTouched(rowNumber, 'email');
}

function markFieldTouched(
  rowNumber: number,
  field: 'email' | 'role' | 'faculty' | 'department',
) {
  const current = rowTouchedFields.value[rowNumber] ?? {
    email: false,
    role: false,
    faculty: false,
    department: false,
  };

  rowTouchedFields.value = {
    ...rowTouchedFields.value,
    [rowNumber]: {
      ...current,
      [field]: true,
    },
  };
}

function isFieldTouched(
  rowNumber: number,
  field: 'email' | 'role' | 'faculty' | 'department',
) {
  return Boolean(rowTouchedFields.value[rowNumber]?.[field]);
}

function getFieldError(row: PreviewRow, fieldKey: SystemFieldKey): string | undefined {
  if (fieldKey === 'email') {
    return row.errors.find(error => error.includes('Missing Email') || error.includes('Invalid email format'));
  }

  if (fieldKey === 'role') {
    return row.errors.find(error => error.includes('Role'));
  }

  if (fieldKey === 'faculty') {
    return row.errors.find(error => error.includes('Faculty'));
  }

  if (fieldKey === 'department') {
    return row.errors.find(error => error.includes('Department'));
  }

  const fieldLabel = systemFields.find(field => field.key === fieldKey)?.label;
  return fieldLabel ? row.errors.find(error => error.includes(`Missing ${fieldLabel}`)) : undefined;
}

function wrapCellWithFieldError(row: PreviewRow, fieldKey: SystemFieldKey, content: string | ReturnType<typeof h>) {
  const error = getFieldError(row, fieldKey);
  if (!error) {
    return content;
  }

  return h(UFormField, { error, class: 'w-full' }, {
    default: () => typeof content === 'string'
      ? h('div', { class: 'text-sm' }, content)
      : content,
  });
}

function getDepartmentItemsForRow(row: PreviewRow): SelectItem[] {
  if (!row.facultyId) {
    return [];
  }

  const departmentsForFaculty = departments.value.filter(item => item.facultyId === row.facultyId);

  return departmentsForFaculty.map(item => ({
    label: item.nameEn,
    value: item.id,
  }));
}

function getRoleDisplayValue(row: PreviewRow) {
  if (row.roleId) {
    const role = roles.value.find(item => item.id === row.roleId);
    if (role) {
      return role.name;
    }
  }

  return row.values.role || '-';
}

function getFacultyDisplayValue(row: PreviewRow) {
  if (row.facultyId) {
    const faculty = faculties.value.find(item => item.id === row.facultyId);
    if (faculty) {
      return faculty.nameEn;
    }
  }

  return row.values.faculty || '-';
}

function getDepartmentDisplayValue(row: PreviewRow) {
  if (row.departmentId) {
    const department = departments.value.find(item => item.id === row.departmentId);
    if (department) {
      return department.nameEn;
    }
  }

  return row.values.department || '-';
}

function shouldKeepRoleEditor(row: PreviewRow) {
  const rawRole = normalize(row.values.role);
  if (!rawRole) {
    return true;
  }

  return !roles.value.some(role => normalize(role.name) === rawRole || String(role.id) === row.values.role.trim());
}

function shouldKeepFacultyEditor(row: PreviewRow) {
  const rawFaculty = normalize(row.values.faculty);
  if (!rawFaculty) {
    return true;
  }

  return !faculties.value.some(faculty =>
    String(faculty.id) === row.values.faculty.trim()
    || normalize(faculty.nameEn) === rawFaculty
    || normalize(faculty.nameTh) === rawFaculty
    || normalize(faculty.facultyCode) === rawFaculty,
  );
}

function shouldKeepDepartmentEditor(row: PreviewRow) {
  const rawDepartment = normalize(row.values.department);
  if (!rawDepartment) {
    return true;
  }

  const matchedDepartment = departments.value.find(department =>
    String(department.id) === row.values.department.trim()
    || normalize(department.nameEn) === rawDepartment
    || normalize(department.nameTh) === rawDepartment
    || normalize(department.departmentCode) === rawDepartment,
  );

  if (!matchedDepartment) {
    return true;
  }

  if (row.facultyId && matchedDepartment.facultyId !== row.facultyId) {
    return true;
  }

  return false;
}

function updateFieldMapping(fieldKey: SystemFieldKey, value: string | number | null) {
  mapping.value[fieldKey] = value === '__unmapped__' || value === null
    ? null
    : String(value);
}

function isHeaderLikeRow(row: CsvRecord, headers: string[]) {
  const headerSet = new Set(headers.map(header => normalize(header)));
  const systemFieldSet = new Set(systemFields.map(field => normalize(field.key)));

  const rowValues = Object.values(row)
    .map(value => normalize(value))
    .filter(Boolean);

  if (rowValues.length === 0) {
    return false;
  }

  const headerLikeCount = rowValues.filter(value => headerSet.has(value) || systemFieldSet.has(value)).length;

  return headerLikeCount === rowValues.length;
}

function normalizeOptionalValue(value: string) {
  const normalized = normalize(value);
  if (normalized === 'null' || normalized === 'undefined' || normalized === '-') {
    return '';
  }
  return String(value ?? '').trim();
}

function isValidEmail(value: string) {
  const email = value.trim();
  const atIndex = email.indexOf('@');
  const lastAtIndex = email.lastIndexOf('@');

  if (atIndex <= 0 || atIndex !== lastAtIndex || atIndex === email.length - 1) {
    return false;
  }

  const domain = email.slice(atIndex + 1);
  const dotIndex = domain.indexOf('.');

  return dotIndex > 0 && dotIndex < domain.length - 1;
}

function resetImportState() {
  importResult.value = null;
  isImporting.value = false;
}

function resetWizardState() {
  currentStep.value = 1;
  uploadedFiles.value = null;
  csvHeaders.value = [];
  csvRows.value = [];
  parseError.value = null;
  showOnlyErrors.value = false;
  currentPage.value = 1;
  itemsPerPage.value = 10;
  defaultRoleId.value = null;
  defaultFacultyId.value = null;
  defaultDepartmentId.value = null;
  isDefaultPanelCollapsed.value = false;
  rowOverrides.value = {};
  rowTouchedFields.value = {};

  mapping.value = {
    id: null,
    title_en: null,
    first_name_en: null,
    last_name_en: null,
    title_th: null,
    first_name_th: null,
    last_name_th: null,
    email: null,
    image: null,
    role: null,
    faculty: null,
    department: null,
  };

  resetImportState();
}

function setAutoMapping() {
  const normalizedHeaders = new Map(csvHeaders.value.map(header => [normalize(header), header]));

  for (const field of systemFields) {
    const directMatch = normalizedHeaders.get(field.key);
    if (directMatch) {
      mapping.value[field.key] = directMatch;
      continue;
    }

    const fallbackMatch = Array.from(normalizedHeaders.entries())
      .find(([header]) => header.replace(/\s+/g, '_') === field.key)?.[1] ?? null;
    mapping.value[field.key] = fallbackMatch;
  }
}

function downloadTemplate() {
  const blob = new Blob([`${csvTemplateHeaders}\n`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'users_import_template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

async function parseCsvFile(file: File) {
  parseError.value = null;
  resetImportState();
  rowOverrides.value = {};
  rowTouchedFields.value = {};
  isParsing.value = true;

  try {
    const result = await new Promise<ParseResult<CsvRecord>>((resolve, reject) => {
      Papa.parse<CsvRecord>(file, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: resolve,
        error: reject,
      });
    });

    if (result.errors.length > 0) {
      parseError.value = result.errors[0]?.message || 'Failed to parse CSV file.';
      return;
    }

    const rows = result.data
      .map((record) => {
        const normalizedRecord: CsvRecord = {};
        for (const [key, value] of Object.entries(record)) {
          normalizedRecord[key] = String(value ?? '').trim();
        }
        return normalizedRecord;
      })
      .filter(row => Object.values(row).some(value => value.length > 0));

    csvHeaders.value = result.meta.fields ?? [];
    csvRows.value = rows.filter(row => !isHeaderLikeRow(row, csvHeaders.value));
    currentPage.value = 1;

    if (csvHeaders.value.length === 0 || csvRows.value.length === 0) {
      parseError.value = 'CSV does not contain valid header or rows.';
      return;
    }

    setAutoMapping();
  }
  catch (error: any) {
    parseError.value = error?.message || 'Failed to parse CSV file.';
  }
  finally {
    isParsing.value = false;
  }
}

function extractFileFromUploadPayload(payload: unknown): File | null {
  if (!payload) {
    return null;
  }

  if (payload instanceof File) {
    return payload;
  }

  const resolveCandidate = (candidate: any): File | null => {
    if (!candidate) {
      return null;
    }

    if (candidate instanceof File) {
      return candidate;
    }

    const nested = candidate.file ?? candidate.raw ?? candidate.blob ?? candidate.value;
    return nested instanceof File ? nested : null;
  };

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const file = resolveCandidate(item);
      if (file) {
        return file;
      }
    }
    return null;
  }

  return resolveCandidate(payload);
}

function isCsvFile(file: File) {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  return fileName.endsWith('.csv') || mimeType === 'text/csv' || mimeType === 'application/vnd.ms-excel';
}

async function handleUploadChange(payload: unknown) {
  parseError.value = null;

  if (!payload || (Array.isArray(payload) && payload.length === 0)) {
    uploadedFiles.value = null;
    csvHeaders.value = [];
    csvRows.value = [];
    rowOverrides.value = {};
    rowTouchedFields.value = {};
    resetImportState();
    return;
  }

  const file = extractFileFromUploadPayload(payload);
  if (!file) {
    uploadedFiles.value = null;
    csvHeaders.value = [];
    csvRows.value = [];
    parseError.value = 'Could not read selected file. Please re-upload the CSV file.';
    return;
  }

  if (!isCsvFile(file)) {
    uploadedFiles.value = null;
    csvHeaders.value = [];
    csvRows.value = [];
    parseError.value = 'Invalid file type. Please upload a .csv file only.';
    return;
  }

  uploadedFiles.value = file;

  await parseCsvFile(file);
}

function goBackStep() {
  if (currentStep.value > 1) {
    currentStep.value -= 1;
  }
}

function goNextStep() {
  if (isFirstStep.value) {
    if (isParsing.value) {
      return;
    }
    if (parseError.value || csvRows.value.length === 0) {
      toast.add({
        title: 'CSV invalid',
        description: 'Please upload a valid CSV file before continuing.',
        color: 'error',
      });
      return;
    }
  }

  if (isMappingStep.value && mappingErrors.value.length > 0) {
    toast.add({
      title: 'Mapping required',
      description: mappingErrors.value[0],
      color: 'error',
    });
    return;
  }

  if (currentStep.value < steps.length) {
    currentStep.value += 1;
  }
}

async function importData() {
  if (!canImport.value) {
    return;
  }

  isImporting.value = true;

  try {
    const response = await $fetch<{ success: number; failed: number; failedRows: string[] }>('/api/users/import', {
      method: 'POST',
      body: {
        users: validRows.value.map(row => ({
          rowNumber: row.rowNumber,
          id: row.values.id,
          titleEn: normalizeOptionalValue(row.values.title_en) || undefined,
          firstNameEn: row.values.first_name_en,
          lastNameEn: row.values.last_name_en,
          titleTh: normalizeOptionalValue(row.values.title_th) || undefined,
          firstNameTh: row.values.first_name_th,
          lastNameTh: row.values.last_name_th,
          email: row.emailValue,
          image: normalizeOptionalValue(row.values.image) || undefined,
          roleAssignments: [
            {
              roleId: row.roleId,
              facultyId: row.facultyId,
              departmentId: row.departmentId,
            },
          ],
        })),
      },
    });

    importResult.value = response;

    if (response.success > 0) {
      toast.add({
        title: 'Import completed',
        description: `${response.success} users imported successfully${response.failed > 0 ? `, ${response.failed} failed.` : '.'}`,
        color: response.failed > 0 ? 'warning' : 'success',
      });
      emit('imported');
    }

    currentStep.value = 4;
  }
  finally {
    isImporting.value = false;
  }
}
</script>

<template>
  <UModal
    v-model:open="isModalOpen"
    title="Bulk User Import"
    :dismissible="false"
    :ui="{ content: 'sm:max-w-7xl', footer: 'justify-end' }"
  >
    <UButton v-if="authStore.can('user.import')" icon="i-lucide-import" size="md" variant="outline">
      Import CSV
    </UButton>

    <template #body>
      <div class="mb-4 flex items-center gap-2 text-xs text-muted">
        <span
          v-for="(step, index) in steps"
          :key="step"
          class="inline-flex items-center gap-2"
        >
          <UBadge :color="currentStep >= index + 1 ? 'primary' : 'neutral'" variant="soft">
            {{ index + 1 }}
          </UBadge>
          <span>{{ step }}</span>
        </span>
      </div>

      <div v-if="currentStep === 1">
        <UFileUpload
          v-model="uploadedFiles"
          label="Upload CSV File"
          description="Drag and drop CSV or click to browse"
          accept="text/csv"
          position="inside"
          layout="list"
          highlight
          class="min-h-48"
          @update:model-value="handleUploadChange"
        />

        <UAlert
          v-if="parseError"
          title="CSV parsing failed"
          :description="`${parseError} Please verify the file format and try again.`"
          icon="i-lucide-circle-alert"
          color="error"
          variant="soft"
          class="mt-4"
        />

        <UAlert
          v-else-if="csvRows.length > 0"
          title="CSV loaded"
          :description="`${csvRows.length} rows detected with ${csvHeaders.length} columns.`"
          icon="i-lucide-check-circle"
          color="success"
          variant="soft"
          class="mt-4"
        />

        <UAlert
          title="Prepare your data"
          description="Ensure your file follows our structure to avoid errors during the import process."
          icon="i-lucide-download"
          variant="soft"
          class="mt-6"
          :actions="[
            {
              label: 'Download Sample Template (.csv)',
              variant: 'link',
              class: 'p-0 underline text-xs font-medium',
              onClick: downloadTemplate,
            },
          ]"
        />
      </div>

      <div v-else-if="currentStep === 2">
        <UAlert
          v-if="mappingErrors.length > 0"
          title="Fix mapping before continuing"
          :description="mappingErrors.join(' | ')"
          icon="i-lucide-circle-alert"
          color="warning"
          variant="soft"
          class="mb-4"
        />

        <UCard>
          <template #header>
            <h3 class="font-semibold text-sm">
              Column Mapping
            </h3>
          </template>

          <div class="space-y-3">
            <div
              v-for="field in systemFields"
              :key="field.key"
              class="grid gap-3 md:grid-cols-2"
            >
              <div class="text-sm flex items-center gap-2">
                <span>{{ field.label }}</span>
                <UBadge v-if="field.required" color="error" variant="soft" size="sm">
                  required
                </UBadge>
              </div>
              <USelectMenu
                :model-value="mapping[field.key] ?? '__unmapped__'"
                :items="mappingSelectItems"
                value-key="value"
                @update:model-value="updateFieldMapping(field.key, $event as string | number | null)"
              />
            </div>
          </div>
        </UCard>
      </div>

      <div v-else-if="currentStep === 3" class="space-y-4">
        <div class="relative xl:min-h-144">
          <div
            class="mb-4 xl:mb-0 xl:absolute xl:top-0 xl:left-0 xl:w-84 transition-transform duration-300 ease-out z-10"
            :class="isDefaultPanelCollapsed ? 'xl:-translate-x-[calc(100%-2.75rem)]' : 'xl:translate-x-0'"
          >
            <UCard>
              <template #header>
                <div class="flex items-start justify-between gap-2">
                  <div class="text-sm">
                    <p class="font-semibold">
                      Default Values
                    </p>
                    <p class="text-muted mt-1">
                      Apply when CSV values are missing or invalid.
                    </p>
                  </div>
                  <UButton
                    :icon="isDefaultPanelCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :aria-label="isDefaultPanelCollapsed ? 'Expand default values panel' : 'Collapse default values panel'"
                    class="hidden xl:flex"
                    @click="isDefaultPanelCollapsed = !isDefaultPanelCollapsed"
                  />
                </div>
              </template>

              <div :class="isDefaultPanelCollapsed ? 'xl:hidden' : ''" class="space-y-4">
                <UFormField label="Default Role">
                  <USelectMenu
                    v-model="defaultRoleId"
                    :items="roleItems"
                    value-key="value"
                    searchable
                    placeholder="Select default role"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Default Faculty">
                  <USelectMenu
                    v-model="defaultFacultyId"
                    :items="facultyItems"
                    value-key="value"
                    searchable
                    placeholder="Select default faculty"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Default Department">
                  <USelectMenu
                    v-model="defaultDepartmentId"
                    :items="defaultDepartmentItems"
                    value-key="value"
                    searchable
                    :placeholder="defaultFacultyId ? 'Select default department' : 'Select default faculty first'"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </UCard>
          </div>

          <div
            class="transition-[padding] duration-300 ease-out"
            :class="isDefaultPanelCollapsed ? 'xl:pl-12' : 'xl:pl-88'"
          >
            <UCard>
              <template #header>
                <div class="flex flex-wrap items-center justify-between gap-4">
                  <div class="text-sm">
                    <p class="font-semibold">
                      Data Preview
                    </p>
                    <p class="text-muted mt-1">
                      <span>Total rows: {{ previewRows.length }}</span> | <span class="text-success">Valid: {{ validRows.length }}</span> | <span class="text-error">Errors: {{ totalErrorRows }}</span>
                    </p>
                  </div>
                  <UCheckbox v-model="showOnlyErrors" label="Show only rows with errors" />
                </div>
              </template>

              <UAlert
                v-if="totalErrorRows > 0"
                title="Validation Errors"
                :description="`${totalErrorRows} invalid row(s) will be skipped and will not be imported.`"
                color="error"
                variant="subtle"
                class="mb-2"
              />

              <UTable
                :data="paginatedRows"
                :columns="tableColumns"
                class="flex-1"
              />

              <div class="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-default pt-4">
                <UPagination
                  v-model:page="currentPage"
                  :items-per-page="itemsPerPage"
                  :total="totalItems"
                  show-edges
                />
                <USelect v-model="itemsPerPage" :items="[10, 20, 50, 100]" />
              </div>
            </UCard>
          </div>
        </div>
      </div>

      <div v-else class="rounded-lg border border-default p-4 space-y-3">
        <p class="text-sm font-semibold">
          Import Complete
        </p>

        <p v-if="importResult" class="text-sm text-muted">
          Success: {{ importResult.success }} | Failed: {{ importResult.failed }}
        </p>

        <UAlert
          v-if="importResult?.failedRows.length"
          title="Failed rows"
          :description="importResult.failedRows.slice(0, 10).join(' | ')"
          color="warning"
          variant="soft"
        />

        <p class="text-sm text-muted">
          Click Finish to close this modal.
        </p>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton v-if="!isCompleteStep" label="Cancel" color="neutral" variant="link" size="lg" @click="close" />

      <UButton
        v-if="backButtonVisible"
        leading-icon="i-lucide-chevron-left"
        label="Back"
        color="neutral"
        variant="soft"
        size="lg"
        @click="goBackStep"
      />

      <UButton
        v-if="isFirstStep || isMappingStep"
        trailing-icon="i-lucide-chevron-right"
        label="Next"
        color="primary"
        size="lg"
        :loading="isParsing"
        @click="goNextStep"
      />
      <UButton
        v-else-if="isPreviewStep"
        trailing-icon="i-lucide-database"
        label="Import Data"
        color="primary"
        size="lg"
        :disabled="!canImport"
        :loading="isImporting"
        @click="importData"
      />
      <UButton
        v-else
        trailing-icon="i-lucide-check"
        label="Finish"
        color="primary"
        size="lg"
        @click="close"
      />
    </template>
  </UModal>
</template>
