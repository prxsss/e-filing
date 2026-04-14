import type { FieldInstance, FileTypeValue, PdfRef } from '~/types/template';

import { getNextFieldInstanceNumber } from '../../shared/field-instance-number';

const CLIPBOARD_PREFIX = 'e-filing:template-field:v1:';
const CLIPBOARD_MULTI_PREFIX = 'e-filing:template-fields:v1:';

let lastCopiedSerialized: string | null = null;

export function serializeTemplateField(field: FieldInstance): string {
  return CLIPBOARD_PREFIX + JSON.stringify(field);
}

export function parseTemplateFieldClipboard(text: string): FieldInstance | null {
  if (!text.startsWith(CLIPBOARD_PREFIX)) {
    return null;
  }
  try {
    const parsed = JSON.parse(text.slice(CLIPBOARD_PREFIX.length)) as FieldInstance;
    if (!parsed || typeof parsed !== 'object' || !parsed.instanceId || parsed.id === undefined) {
      return null;
    }
    return parsed;
  }
  catch {
    return null;
  }
}

function isValidFieldClipboardItem(parsed: unknown): parsed is FieldInstance {
  return Boolean(
    parsed
    && typeof parsed === 'object'
    && (parsed as FieldInstance).instanceId
    && (parsed as FieldInstance).id !== undefined,
  );
}

export function serializeTemplateFields(fields: FieldInstance[]): string {
  return CLIPBOARD_MULTI_PREFIX + JSON.stringify(fields);
}

export function parseTemplateFieldsClipboard(text: string): FieldInstance[] | null {
  if (!text.startsWith(CLIPBOARD_MULTI_PREFIX)) {
    return null;
  }
  try {
    const parsed = JSON.parse(text.slice(CLIPBOARD_MULTI_PREFIX.length)) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }
    const fields = parsed.filter(isValidFieldClipboardItem);
    return fields.length ? fields : null;
  }
  catch {
    return null;
  }
}

export function rememberCopiedTemplateField(serialized: string): void {
  lastCopiedSerialized = serialized;
}

export function getLastCopiedTemplateFieldSerialized(): string | null {
  return lastCopiedSerialized;
}

export async function writeTemplateFieldToSystemClipboard(field: FieldInstance): Promise<void> {
  const serialized = serializeTemplateField(field);
  rememberCopiedTemplateField(serialized);
  try {
    await navigator.clipboard.writeText(serialized);
  }
  catch {
    // Non-secure context or denied — in-memory copy still works for paste in-session.
  }
}

/** Copies one or more fields; single-field payload stays compatible with older readers. */
export async function writeTemplateFieldsToSystemClipboard(fields: FieldInstance[]): Promise<void> {
  if (fields.length === 0) {
    return;
  }
  const serialized = fields.length === 1
    ? serializeTemplateField(fields[0]!)
    : serializeTemplateFields(fields);
  rememberCopiedTemplateField(serialized);
  try {
    await navigator.clipboard.writeText(serialized);
  }
  catch {
    // Non-secure context or denied — in-memory copy still works for paste in-session.
  }
}

export function buildPastedFieldInstance(
  sourceSnapshot: FieldInstance,
  placedFields: FieldInstance[],
  opts: {
    pdfRef: PdfRef | null;
    fileType: FileTypeValue;
    currentPage: number;
    groupIdMapBySourceId?: Record<string, string>;
    pastedGroupSizeBySourceId?: Record<string, number>;
    groupPositionCursorBySourceId?: Record<string, number>;
  },
): FieldInstance {
  const raw = JSON.parse(JSON.stringify(sourceSnapshot)) as FieldInstance;

  raw.instanceId = `field_${raw.id}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  raw.instanceNumber = getNextFieldInstanceNumber(placedFields, raw);

  const sourceGroupId = String(raw.groupId ?? '').trim();
  const groupedPasteSize = sourceGroupId.length > 0
    ? Number(opts.pastedGroupSizeBySourceId?.[sourceGroupId] ?? 0)
    : 0;

  if (sourceGroupId.length > 0 && groupedPasteSize > 1) {
    const existingMappedGroupId = opts.groupIdMapBySourceId?.[sourceGroupId];
    const mappedGroupId = existingMappedGroupId?.trim().length
      ? existingMappedGroupId
      : `group_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    if (opts.groupIdMapBySourceId) {
      opts.groupIdMapBySourceId[sourceGroupId] = mappedGroupId;
    }

    const cursor = Number(opts.groupPositionCursorBySourceId?.[sourceGroupId] ?? 0);
    if (opts.groupPositionCursorBySourceId) {
      opts.groupPositionCursorBySourceId[sourceGroupId] = cursor + 1;
    }

    raw.groupId = mappedGroupId;
    raw.isGrouped = true;
    raw.groupSize = groupedPasteSize;
    raw.groupPosition = Math.max(0, Math.min(groupedPasteSize - 1, cursor));
  }
  else {
    raw.groupId = null;
    raw.isGrouped = false;
    raw.groupSize = 1;
    raw.groupPosition = 0;
  }

  raw.pageNumber = opts.currentPage;

  // Same offset for every pasted field so multi-select paste keeps relative layout (no cumulative n×24).
  const OFFSET = 24;
  const pdfRef = opts.pdfRef;

  if (pdfRef && opts.fileType === 'pdf' && raw.normalizedX !== undefined && raw.normalizedY !== undefined) {
    const display = pdfRef.normalizedToDisplay(
      raw.normalizedX,
      raw.normalizedY,
      raw.normalizedWidth ?? 0,
      raw.normalizedHeight ?? 0,
    );
    const normalized = pdfRef.displayToNormalized(
      display.x + OFFSET,
      display.y + OFFSET,
      display.width,
      display.height,
    );
    raw.normalizedX = normalized.x;
    raw.normalizedY = normalized.y;
    raw.normalizedWidth = normalized.width;
    raw.normalizedHeight = normalized.height;
    raw.x = display.x + OFFSET;
    raw.y = display.y + OFFSET;
    raw.width = display.width;
    raw.height = display.height;
  }
  else {
    raw.x = (raw.x ?? 0) + OFFSET;
    raw.y = (raw.y ?? 0) + OFFSET;
  }

  return raw;
}

export async function readTemplateFieldFromClipboard(): Promise<FieldInstance | null> {
  const multi = await readTemplateFieldsFromClipboard();
  if (!multi || multi.length !== 1) {
    return null;
  }
  return multi[0]!;
}

/** Returns pasted field snapshots (multi or single); `null` if nothing valid is available. */
export async function readTemplateFieldsFromClipboard(): Promise<FieldInstance[] | null> {
  let text: string | null = null;
  try {
    text = await navigator.clipboard.readText();
  }
  catch {
    // Permission or unsupported
  }
  const tryParse = (raw: string): FieldInstance[] | null => {
    const multi = parseTemplateFieldsClipboard(raw);
    if (multi) {
      return multi;
    }
    const single = parseTemplateFieldClipboard(raw);
    return single ? [single] : null;
  };
  if (text) {
    const parsed = tryParse(text);
    if (parsed) {
      return parsed;
    }
  }
  const fallback = getLastCopiedTemplateFieldSerialized();
  if (fallback) {
    return tryParse(fallback);
  }
  return null;
}
