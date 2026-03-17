export type FieldInstanceLike = {
  id?: string | number | null;
  instanceId?: string | null;
  instanceNumber?: number | string | null;
  name?: string | null;
  label?: string | null;
  type?: string | null;
  fieldType?: string | null;
};

function normalizeFieldKey(field: FieldInstanceLike): string {
  const fieldId = field?.id !== undefined && field?.id !== null
    ? String(field.id).trim()
    : '';

  if (fieldId.length) {
    return `id:${fieldId}`;
  }

  const fieldType = String(field?.type || field?.fieldType || '').trim().toLowerCase();
  const fieldName = String(field?.name || field?.label || '').trim().toLowerCase();
  return `type:${fieldType}|name:${fieldName}`;
}

function getStoredInstanceNumber(field?: FieldInstanceLike): number {
  const parsed = Number(field?.instanceNumber);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.floor(parsed);
}

export function getFieldDisplayInstanceNumber(
  field: FieldInstanceLike | null | undefined,
  fields: FieldInstanceLike[] = [],
): number {
  if (!field) {
    return 1;
  }

  const storedNumber = getStoredInstanceNumber(field);
  const sameFields = fields.filter(candidate => normalizeFieldKey(candidate) === normalizeFieldKey(field));

  if (sameFields.length <= 1) {
    return storedNumber;
  }

  const storedNumbers = sameFields.map(candidate => getStoredInstanceNumber(candidate));
  const hasUniqueStoredNumbers = storedNumbers.length === sameFields.length
    && new Set(storedNumbers).size === sameFields.length;

  if (hasUniqueStoredNumbers) {
    return storedNumber;
  }

  const occurrenceIndex = sameFields.findIndex(candidate => String(candidate?.instanceId ?? '').trim() === String(field.instanceId ?? '').trim());
  if (occurrenceIndex >= 0) {
    return occurrenceIndex + 1;
  }

  return storedNumber;
}

export function getNextFieldInstanceNumber(
  fields: FieldInstanceLike[],
  field: FieldInstanceLike,
): number {
  const sameFields = fields.filter(candidate => normalizeFieldKey(candidate) === normalizeFieldKey(field));
  if (!sameFields.length) {
    return 1;
  }

  const maxExistingNumber = sameFields.reduce((maxNumber, candidate) => {
    const displayNumber = getFieldDisplayInstanceNumber(candidate, sameFields);
    return Math.max(maxNumber, displayNumber);
  }, 0);

  return maxExistingNumber + 1;
}
