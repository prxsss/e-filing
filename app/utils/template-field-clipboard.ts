import type { FieldInstance, FileTypeValue, PdfRef } from '~/types/template';

import { getNextFieldInstanceNumber } from '../../shared/field-instance-number';

const CLIPBOARD_PREFIX = 'e-filing:template-field:v1:';

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

export function buildPastedFieldInstance(
  sourceSnapshot: FieldInstance,
  placedFields: FieldInstance[],
  opts: {
    pdfRef: PdfRef | null;
    fileType: FileTypeValue;
    currentPage: number;
  },
): FieldInstance {
  const raw = JSON.parse(JSON.stringify(sourceSnapshot)) as FieldInstance;

  raw.instanceId = `field_${raw.id}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  raw.instanceNumber = getNextFieldInstanceNumber(placedFields, raw);

  raw.isGrouped = false;
  raw.groupSize = 1;
  raw.groupPosition = 0;
  if (raw.groupId != null && String(raw.groupId).trim().length > 0) {
    raw.groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  raw.pageNumber = opts.currentPage;

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
  let fromClipboard: FieldInstance | null = null;
  try {
    const text = await navigator.clipboard.readText();
    fromClipboard = parseTemplateFieldClipboard(text);
  }
  catch {
    // Permission or unsupported
  }
  if (fromClipboard) {
    return fromClipboard;
  }
  const fallback = getLastCopiedTemplateFieldSerialized();
  if (fallback) {
    return parseTemplateFieldClipboard(fallback);
  }
  return null;
}
