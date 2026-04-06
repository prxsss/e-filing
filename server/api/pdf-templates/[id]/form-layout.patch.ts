import { eq } from 'drizzle-orm';

import db from '../../../../lib/db';
import { requestTemplate } from '../../../../lib/db/schema';

type EntryField = {
  kind: 'field';
  order: number;
  instanceId: string;
  questionLabel?: string;
  required?: boolean;
};

type EntryGroup = {
  kind: 'group';
  order: number;
  id: string;
  title?: string;
  required?: boolean;
  fields: Array<{ instanceId: string; questionLabel?: string }>;
};

type LayoutEntry = EntryField | EntryGroup;

function getPlacedFieldInstanceId(field: Record<string, unknown> | null | undefined): string {
  if (!field || typeof field !== 'object')
    return '';
  const raw = (field as any).instanceId ?? (field as any).instance_id;
  return String(raw ?? '').trim();
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string')
    return value;
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

  const body = await readBody<{ sectionTitle?: string; entries?: LayoutEntry[] } | null>(event);
  const sectionTitle = String(body?.sectionTitle || 'Request Information').trim() || 'Request Information';
  const entries: LayoutEntry[] = Array.isArray(body?.entries) ? body!.entries! : [];

  type FieldConfig = {
    questionLabel: string;
    formOrder: number;
    required: boolean;
    formGroupId: string | null;
    formGroupTitle: string | null;
  };
  const fieldConfigMap = new Map<string, FieldConfig>();
  const groupsToStore: Array<{ id: string; title: string; required: boolean; order: number; fieldInstanceIds: string[] }> = [];

  let flatOrder = 0;
  for (const entry of entries) {
    if (entry.kind === 'field') {
      flatOrder++;
      const iid = String(entry.instanceId || '').trim();
      if (iid) {
        fieldConfigMap.set(iid, {
          questionLabel: String(entry.questionLabel || '').trim(),
          formOrder: flatOrder * 100,
          required: entry.required !== false,
          formGroupId: null,
          formGroupTitle: null,
        });
      }
    }
    else if (entry.kind === 'group') {
      flatOrder++;
      const groupId = String(entry.id || '').trim();
      const groupTitle = String(entry.title || '').trim();
      const groupRequired = entry.required !== false;
      const fieldInstanceIds: string[] = [];
      if (groupId) {
        let fieldPos = 0;
        for (const gf of (entry.fields ?? [])) {
          fieldPos++;
          const iid = String(gf.instanceId || '').trim();
          if (iid) {
            fieldInstanceIds.push(iid);
            fieldConfigMap.set(iid, {
              questionLabel: String(gf.questionLabel || '').trim(),
              formOrder: flatOrder * 100 + fieldPos,
              required: groupRequired,
              formGroupId: groupId,
              formGroupTitle: groupTitle,
            });
          }
        }
        groupsToStore.push({ id: groupId, title: groupTitle, required: groupRequired, order: flatOrder * 100, fieldInstanceIds });
      }
    }
  }

  const currentTemplate = await db
    .select({ id: requestTemplate.id, placedFieldsData: requestTemplate.placedFieldsData })
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
    if (!instanceId.length)
      return field;
    const config = fieldConfigMap.get(instanceId);
    if (!config)
      return field;
    return {
      ...field,
      formSectionTitle: sectionTitle,
      formQuestionLabel: config.questionLabel || String(field?.formQuestionLabel || field?.label || field?.name || ''),
      formOrder: config.formOrder,
      formRequired: config.required,
      formGroupId: config.formGroupId,
      formGroupTitle: config.formGroupTitle,
    };
  });

  const updated = await db
    .update(requestTemplate)
    .set({ placedFieldsData: updatedPlacedFieldsData })
    .where(eq(requestTemplate.id, id))
    .returning({
      id: requestTemplate.id,
      placedFieldsData: requestTemplate.placedFieldsData,
    });

  return { success: true, data: updated[0] };
});
