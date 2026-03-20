import { eq } from 'drizzle-orm';

import db from '../../../../lib/db';
import { requestTemplate } from '../../../../lib/db/schema';

type LayoutFieldInput = {
  instanceId: string;
  questionLabel?: string;
  order?: number;
};

function getPlacedFieldInstanceId(field: Record<string, unknown> | null | undefined): string {
  if (!field || typeof field !== 'object') {
    return '';
  }
  const raw = (field as any).instanceId ?? (field as any).instance_id;
  return String(raw ?? '').trim();
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  }
  catch {
    return value;
  }
}

export default defineEventHandler(async (event) => {
  const id = Number.parseInt(getRouterParam(event, 'id') || '', 10);
  if (Number.isNaN(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid template ID' });
  }

  const body = await readBody<{ sectionTitle?: string; fields?: LayoutFieldInput[] } | null>(event);
  const sectionTitle = String(body?.sectionTitle || 'Request Information').trim() || 'Request Information';
  const fields = Array.isArray(body?.fields) ? body!.fields! : [];
  const fieldConfigMap = new Map<string, { questionLabel: string; order: number }>();

  for (const field of fields) {
    const instanceId = String(field?.instanceId || '').trim();
    if (!instanceId.length) {
      continue;
    }
    fieldConfigMap.set(instanceId, {
      questionLabel: String(field?.questionLabel || '').trim(),
      order: Number.isFinite(Number(field?.order)) ? Number(field!.order) : Number.MAX_SAFE_INTEGER,
    });
  }

  const currentTemplate = await db
    .select({
      id: requestTemplate.id,
      placedFieldsData: requestTemplate.placedFieldsData,
    })
    .from(requestTemplate)
    .where(eq(requestTemplate.id, id))
    .limit(1);

  if (!currentTemplate.length) {
    throw createError({ statusCode: 404, message: 'Template not found' });
  }

  const rawFields = parseMaybeJson(currentTemplate[0]!.placedFieldsData);
  const placedFieldsData = Array.isArray(rawFields) ? rawFields : [];

  const updatedPlacedFieldsData = placedFieldsData.map((field: any) => {
    const instanceId = getPlacedFieldInstanceId(field);
    if (!instanceId.length) {
      return field;
    }
    const config = fieldConfigMap.get(instanceId);
    return {
      ...field,
      formSectionTitle: sectionTitle,
      formQuestionLabel: config?.questionLabel || String(field?.formQuestionLabel || field?.label || field?.name || ''),
      formOrder: config?.order ?? field?.formOrder ?? Number.MAX_SAFE_INTEGER,
    };
  });

  const updated = await db
    .update(requestTemplate)
    .set({
      placedFieldsData: updatedPlacedFieldsData,
    })
    .where(eq(requestTemplate.id, id))
    .returning({
      id: requestTemplate.id,
      placedFieldsData: requestTemplate.placedFieldsData,
    });

  return {
    success: true,
    data: updated[0],
  };
});
