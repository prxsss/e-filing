import { isFormFieldRequired } from './form-field-required';

/** Matches student PDF form checkbox detection (includes legacy "check mark" name). */
export function isStudentCheckboxField(field: { type?: string; fieldType?: string; name?: string } | null | undefined): boolean {
  const fieldType = String(field?.type || field?.fieldType || '').toLowerCase();
  const fieldName = String(field?.name || '').trim().toLowerCase();
  return fieldType === 'checkbox' || fieldName === 'check mark';
}

export function getStudentCheckboxGroupId(field: { groupId?: string | null } | null | undefined): string {
  return String(field?.groupId ?? '').trim();
}

export function normalizeStudentCheckboxValue(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'checked', 'on'].includes(normalized) ? 'true' : '';
}

function fieldIssueLabel(field: { formQuestionLabel?: string; label?: string; name?: string }): string {
  return String(field.formQuestionLabel || field.label || field.name || 'ช่องนี้');
}

/**
 * Visible student fillable fields: required check.
 * Checkboxes with the same non-empty `groupId` are one unit — if any member is required,
 * at least one checkbox in that group must be checked (mutually exclusive group UX).
 */
export function validateVisibleRequiredStudentFields<T extends { type?: string; fieldType?: string; name?: string; groupId?: string | null; formRequired?: boolean; form_required?: boolean; formQuestionLabel?: string; label?: string }>(
  fields: T[],
  resolveCurrentFieldValue: (field: T) => string,
): string | null {
  const validatedCheckboxGroups = new Set<string>();

  for (const field of fields) {
    if (!isFormFieldRequired(field)) {
      continue;
    }

    if (isStudentCheckboxField(field)) {
      const groupId = getStudentCheckboxGroupId(field);
      if (groupId.length > 0) {
        if (validatedCheckboxGroups.has(groupId)) {
          continue;
        }
        validatedCheckboxGroups.add(groupId);
        const anyChecked = fields.some((candidate) => {
          if (!isStudentCheckboxField(candidate) || getStudentCheckboxGroupId(candidate) !== groupId) {
            return false;
          }
          return normalizeStudentCheckboxValue(resolveCurrentFieldValue(candidate)) === 'true';
        });
        if (!anyChecked) {
          return `กรุณาติ๊ก: ${fieldIssueLabel(field)}`;
        }
        continue;
      }

      const value = resolveCurrentFieldValue(field) || '';
      if (normalizeStudentCheckboxValue(value) !== 'true') {
        return `กรุณาติ๊ก: ${fieldIssueLabel(field)}`;
      }
      continue;
    }

    const value = resolveCurrentFieldValue(field) || '';
    if (!String(value).trim()) {
      return `กรุณากรอก: ${fieldIssueLabel(field)}`;
    }
  }

  return null;
}
