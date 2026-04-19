<script lang="ts" setup>
import { LazyBaseConfirmDialog } from '#components';

definePageMeta({
  title: 'documentReview',
  middleware: ['permission'],
  permission: 'template.view',
});

// --- Types ---
type Template = {
  id: number;
  name: string | null;
  description: string | null;
  version: string | null;
  isActive: boolean | null;
  createdBy: number | null;
  createdAt: string;
  documentUrl: string | null;
  documentWidth: number | null;
  documentHeight: number | null;
  placedFieldsData: unknown;
  signingFlowData: unknown;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type SigningStepSummary = {
  id: string;
  order: number;
  roleName: string;
  description: string | null;
  isRequired: boolean;
  suggestionNote: string | null;
  color: string;
};

const DEFAULT_SIGNING_STEP_COLOR = '#94A3B8';
const SUGGESTION_NOTE_MAX_LENGTH = 240;

// --- State ---
const route = useRoute();
const router = useRouter();
const overlay = useOverlay();
const toast = useToast();
const localePath = useLocalePath();
const { t } = useI18n();

function tr(key: string, params?: Record<string, unknown>) {
  return params ? t(`adminTemplates.detail.${key}`, params) : t(`adminTemplates.detail.${key}`);
}
const templateId = computed(() => {
  const value = route.params.id;
  return Array.isArray(value) ? value[0] : value;
});
const template = ref<Template | null>(null);
const isLoading = ref(true);
const isDeleting = ref(false);
const error = ref<string | null>(null);

const authStore = useAuthStore();

const confirmDialog = overlay.create(LazyBaseConfirmDialog);

const placedFields = ref<any[]>([]);
const previewFieldValues = ref<Record<string, string>>({});
const isEditingFormLayout = ref(false);
const formSectionTitle = ref(tr('requestInformation'));
const isSavingFormLayout = ref(false);
const activeEditingFieldId = ref<string | null>(null);
const fieldSuggestionNotes = ref<Record<string, string>>({});
const signerSuggestionNoteMap = ref<Record<string, string>>({});

// ─── Layout item types ────
type AdminLayoutField = {
  kind: 'field';
  instanceId: string;
  questionLabel: string;
  required: boolean;
};

type AdminLayoutGroup = {
  kind: 'group';
  id: string;
  title: string;
  required: boolean;
  fields: Array<{ instanceId: string; questionLabel: string }>;
};

type AdminLayoutItem = AdminLayoutField | AdminLayoutGroup;

type FormLayoutSnapshot = {
  sectionTitle: string;
  items: AdminLayoutItem[];
};

const layoutItems = ref<AdminLayoutItem[]>([]);
const formLayoutEditSnapshot = ref<FormLayoutSnapshot | null>(null);

const signingSteps = computed<SigningStepSummary[]>(() => normalizeSigningFlowData(template.value?.signingFlowData));

const templateDescriptionPreview = computed(() => {
  if (isLoading.value)
    return tr('loading');

  return template.value?.description?.trim() || tr('noDescription');
});

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

function normalizeSuggestionNote(value: unknown): string {
  const text = String(value ?? '').trim();
  if (text.length <= SUGGESTION_NOTE_MAX_LENGTH)
    return text;
  return text.slice(0, SUGGESTION_NOTE_MAX_LENGTH);
}

function normalizePlacedFieldsData(value: unknown): any[] {
  const parsed = parseMaybeJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

function getFieldType(field: any): string {
  return String(field?.type || field?.fieldType || '').toLowerCase();
}

function isCheckboxField(field: any): boolean {
  const fieldType = getFieldType(field);
  const fieldName = String(field?.name || '').trim().toLowerCase();
  return fieldType === 'checkbox' || fieldName === 'check mark';
}

function normalizeCheckboxValue(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'checked', 'on'].includes(normalized) ? 'true' : '';
}

function getFieldValueKey(field: any): string {
  const instanceKey = String(field?.instanceId ?? '').trim();
  if (instanceKey.length > 0) {
    return instanceKey;
  }
  const idKey = String(field?.id ?? '').trim();
  return idKey;
}

function getVisibilityRule(field: any) {
  const rawRule = field?.visibilityRule ?? field?.visibility_rule;
  if (!rawRule || typeof rawRule !== 'object') {
    return null;
  }
  const sourceFieldInstanceId = String(rawRule.sourceFieldInstanceId ?? rawRule.source_field_instance_id ?? '').trim();
  const sourceGroupId = String(rawRule.sourceGroupId ?? rawRule.source_group_id ?? '').trim();
  if (!sourceFieldInstanceId.length && !sourceGroupId.length) {
    return null;
  }
  return {
    enabled: rawRule.enabled !== false,
    sourceFieldInstanceId: sourceFieldInstanceId || null,
    sourceGroupId: sourceGroupId || null,
    operator: rawRule.operator === 'isUnchecked' ? 'isUnchecked' : 'isChecked',
  };
}

function resolveCurrentFieldValue(field: any): string {
  const key = getFieldValueKey(field);
  const value = key ? (previewFieldValues.value[key] || '') : '';
  if (isCheckboxField(field)) {
    return normalizeCheckboxValue(value);
  }
  return value;
}

function isFieldVisible(field: any): boolean {
  const rule = getVisibilityRule(field);
  if (!rule || rule.enabled === false) {
    return true;
  }
  let isChecked = false;
  if (rule.sourceGroupId) {
    const groupCheckboxes = placedFields.value.filter((candidate) => {
      return isCheckboxField(candidate) && String(candidate?.groupId ?? '').trim() === rule.sourceGroupId;
    });
    isChecked = groupCheckboxes.some(candidate => normalizeCheckboxValue(resolveCurrentFieldValue(candidate)) === 'true');
  }
  else {
    const sourceField = placedFields.value.find(
      candidate => String(candidate?.instanceId ?? '').trim() === String(rule.sourceFieldInstanceId ?? ''),
    );
    if (!sourceField) {
      return true;
    }
    isChecked = normalizeCheckboxValue(resolveCurrentFieldValue(sourceField)) === 'true';
  }
  return rule.operator === 'isUnchecked' ? !isChecked : isChecked;
}

/** All student-fillable fields for the layout editor. */
const layoutEditorFillableFields = computed(() => {
  return placedFields.value.filter((field: any) =>
    field.isFillable !== false
    && field.is_fillable !== false
    && getFieldType(field) !== 'signature',
  );
});

const orderedLayoutEditorFieldsById = computed(() => {
  const map = new Map<string, any>();
  for (const field of layoutEditorFillableFields.value) {
    map.set(String(field.instanceId), field);
  }
  return map;
});

/** Groups currently in the layout. */
const availableGroups = computed(() =>
  layoutItems.value.filter((it): it is AdminLayoutGroup => it.kind === 'group'),
);

// ─── Sync from template data ───────────────────────────────────────────────
function syncLayoutItems() {
  const sourceFields = [...layoutEditorFillableFields.value].sort((a: any, b: any) => {
    const ao = Number.isFinite(Number(a?.formOrder)) ? Number(a.formOrder) : Number.MAX_SAFE_INTEGER;
    const bo = Number.isFinite(Number(b?.formOrder)) ? Number(b.formOrder) : Number.MAX_SAFE_INTEGER;
    return ao !== bo ? ao - bo : String(a?.instanceId ?? '').localeCompare(String(b?.instanceId ?? ''));
  });

  const sectionField = sourceFields.find((f: any) => String(f?.formSectionTitle || '').trim().length > 0);
  if (sectionField)
    formSectionTitle.value = String((sectionField as any).formSectionTitle);

  const groupMap = new Map<string, AdminLayoutGroup>();
  const items: Array<{ order: number; item: AdminLayoutItem }> = [];

  for (const field of sourceFields) {
    const gid = String((field as any)?.formGroupId ?? '').trim();
    const fo = Number.isFinite(Number((field as any)?.formOrder)) ? Number((field as any).formOrder) : Number.MAX_SAFE_INTEGER;

    if (gid) {
      if (!groupMap.has(gid)) {
        const group: AdminLayoutGroup = {
          kind: 'group',
          id: gid,
          title: String((field as any).formGroupTitle ?? '').trim(),
          required: (field as any).formRequired !== false && (field as any).form_required !== false,
          fields: [],
        };
        groupMap.set(gid, group);
        items.push({ order: fo, item: group });
      }
      groupMap.get(gid)!.fields.push({
        instanceId: String(field.instanceId),
        questionLabel: String((field as any).formQuestionLabel || (field as any).label || (field as any).name || ''),
      });
    }
    else {
      items.push({
        order: fo,
        item: {
          kind: 'field',
          instanceId: String(field.instanceId),
          questionLabel: String((field as any).formQuestionLabel || (field as any).label || (field as any).name || ''),
          required: (field as any).formRequired !== false && (field as any).form_required !== false,
        },
      });
    }
  }

  items.sort((a, b) => a.order - b.order);
  layoutItems.value = items.map(i => i.item);

  fieldSuggestionNotes.value = {};
  for (const field of sourceFields) {
    const instanceId = String(field?.instanceId ?? '').trim();
    if (!instanceId)
      continue;
    fieldSuggestionNotes.value[instanceId] = normalizeSuggestionNote(field?.formSuggestionNote);
  }

  signerSuggestionNoteMap.value = {};
  const rawSigningFlow = parseMaybeJson(template.value?.signingFlowData);
  const signingFlow = Array.isArray(rawSigningFlow) ? rawSigningFlow : [];
  for (const step of signingFlow as any[]) {
    const stepId = String(step?.id ?? '').trim();
    if (!stepId)
      continue;
    signerSuggestionNoteMap.value[stepId] = normalizeSuggestionNote(step?.suggestionNote);
  }
}

// Keep alias so fetchTemplate() / watcher still work after rename.
function syncFormFieldLayout() {
  syncLayoutItems();
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function setQuestionLabel(instanceId: string, value: string) {
  for (const item of layoutItems.value) {
    if (item.kind === 'field' && item.instanceId === instanceId) {
      item.questionLabel = value;
      return;
    }
    if (item.kind === 'group') {
      const inner = item.fields.find(f => f.instanceId === instanceId);
      if (inner) {
        inner.questionLabel = value;
        return;
      }
    }
  }
}

function setFieldSuggestionNote(instanceId: string, note: string) {
  fieldSuggestionNotes.value[instanceId] = normalizeSuggestionNote(note);
}

function getFieldSuggestionNote(instanceId: string): string {
  return fieldSuggestionNotes.value[instanceId] ?? '';
}

function setSignerSuggestionNote(stepId: string, note: string) {
  signerSuggestionNoteMap.value[stepId] = normalizeSuggestionNote(note);
}

function getSignerSuggestionNote(stepId: string): string {
  return signerSuggestionNoteMap.value[stepId] ?? '';
}

function getLayoutEntry(instanceId: string): { required: boolean } | undefined {
  for (const item of layoutItems.value) {
    if (item.kind === 'field' && item.instanceId === instanceId)
      return { required: item.required };
    if (item.kind === 'group' && item.fields.some(f => f.instanceId === instanceId))
      return { required: item.required };
  }
  return undefined;
}

function setLayoutRequired(instanceId: string, value: boolean) {
  for (const item of layoutItems.value) {
    if (item.kind === 'field' && item.instanceId === instanceId) {
      item.required = value;
      return;
    }
  }
}

function setGroupRequired(groupId: string, value: boolean) {
  const g = availableGroups.value.find(g => g.id === groupId);
  if (g)
    g.required = value;
}

function getPreviewFormRequired(field: any): boolean {
  if (isEditingFormLayout.value) {
    const entry = getLayoutEntry(String(field?.instanceId ?? ''));
    return entry ? entry.required !== false : true;
  }
  return field.formRequired !== false && field.form_required !== false;
}

function revertQuestionLabelIfEmpty(instanceId: string) {
  const current = (() => {
    for (const item of layoutItems.value) {
      if (item.kind === 'field' && item.instanceId === instanceId)
        return item.questionLabel;
      if (item.kind === 'group') {
        const inner = item.fields.find(f => f.instanceId === instanceId);
        if (inner)
          return inner.questionLabel;
      }
    }
    return '';
  })();
  if (String(current ?? '').trim().length > 0)
    return;
  const snap = formLayoutEditSnapshot.value;
  if (snap) {
    for (const it of snap.items) {
      if (it.kind === 'field' && it.instanceId === instanceId && it.questionLabel.trim()) {
        setQuestionLabel(instanceId, it.questionLabel);
        return;
      }
      if (it.kind === 'group') {
        const inner = it.fields.find(f => f.instanceId === instanceId);
        if (inner && inner.questionLabel.trim()) {
          setQuestionLabel(instanceId, inner.questionLabel);
          return;
        }
      }
    }
  }
  const tf = placedFields.value.find((f: any) => String(f?.instanceId ?? '') === instanceId);
  setQuestionLabel(instanceId, tf ? String((tf as any).formQuestionLabel || (tf as any).label || (tf as any).name || '') : '');
}

function revertSectionTitleIfEmpty() {
  if (String(formSectionTitle.value ?? '').trim().length > 0)
    return;
  const snap = formLayoutEditSnapshot.value;
  if (snap)
    formSectionTitle.value = String(snap.sectionTitle ?? '');
}

function focusLayoutInputByInstanceId(instanceId: string) {
  if (!instanceId)
    return;
  activeEditingFieldId.value = instanceId;
  let row = document.getElementById(`form-layout-row-${instanceId}`);
  if (!row) {
    for (const item of layoutItems.value) {
      if (item.kind === 'group' && item.fields.some(f => f.instanceId === instanceId)) {
        row = document.getElementById(`form-layout-group-${item.id}`);
        break;
      }
    }
  }
  if (!row)
    return;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const input = row.querySelector('input');
  if (input) {
    setTimeout(() => {
      (input as HTMLInputElement).focus();
      (input as HTMLInputElement).select();
    }, 120);
  }
}

// ─── Group management ──────────────────────────────────────────────────────
function addGroupAt(index: number) {
  const id = `grp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  layoutItems.value.splice(index, 0, { kind: 'group', id, title: '', required: true, fields: [] });
}

function removeGroup(groupId: string) {
  const idx = layoutItems.value.findIndex(it => it.kind === 'group' && (it as AdminLayoutGroup).id === groupId);
  if (idx < 0)
    return;
  const group = layoutItems.value[idx] as AdminLayoutGroup;
  const released: AdminLayoutField[] = group.fields.map(f => ({
    kind: 'field' as const,
    instanceId: f.instanceId,
    questionLabel: f.questionLabel || String((orderedLayoutEditorFieldsById.value.get(f.instanceId) as any)?.label || (orderedLayoutEditorFieldsById.value.get(f.instanceId) as any)?.name || ''),
    required: group.required,
  }));
  layoutItems.value.splice(idx, 1, ...released);
}

function assignFieldToGroup(instanceId: string, groupId: string) {
  const idx = layoutItems.value.findIndex(it => it.kind === 'field' && (it as AdminLayoutField).instanceId === instanceId);
  if (idx < 0)
    return;
  const fieldItem = layoutItems.value[idx] as AdminLayoutField;
  layoutItems.value.splice(idx, 1);
  const group = layoutItems.value.find(it => it.kind === 'group' && (it as AdminLayoutGroup).id === groupId) as AdminLayoutGroup | undefined;
  if (group)
    group.fields.push({ instanceId: fieldItem.instanceId, questionLabel: fieldItem.questionLabel });
}

function removeFieldFromGroup(groupId: string, instanceId: string) {
  const group = layoutItems.value.find(it => it.kind === 'group' && (it as AdminLayoutGroup).id === groupId) as AdminLayoutGroup | undefined;
  if (!group)
    return;
  const fi = group.fields.findIndex(f => f.instanceId === instanceId);
  if (fi < 0)
    return;
  const removed = group.fields.splice(fi, 1)[0];
  if (!removed)
    return;
  const groupIdx = layoutItems.value.findIndex(it => it.kind === 'group' && (it as AdminLayoutGroup).id === groupId);
  const fieldObj = orderedLayoutEditorFieldsById.value.get(instanceId);
  layoutItems.value.splice(groupIdx + 1, 0, {
    kind: 'field',
    instanceId: removed.instanceId,
    questionLabel: removed.questionLabel || String((fieldObj as any)?.formQuestionLabel || (fieldObj as any)?.label || (fieldObj as any)?.name || ''),
    required: group.required,
  });
}

function moveFieldInGroup(groupId: string, fieldIndex: number, direction: -1 | 1) {
  const group = layoutItems.value.find(it => it.kind === 'group' && (it as AdminLayoutGroup).id === groupId) as AdminLayoutGroup | undefined;
  if (!group)
    return;
  const to = fieldIndex + direction;
  if (to < 0 || to >= group.fields.length)
    return;
  [group.fields[fieldIndex], group.fields[to]] = [group.fields[to]!, group.fields[fieldIndex]!];
}

// ─── Reorder & drag-drop (top-level items only) ────────────────────────────
function moveLayoutItem(itemIndex: number, direction: -1 | 1) {
  const to = itemIndex + direction;
  if (to < 0 || to >= layoutItems.value.length)
    return;
  const arr = [...layoutItems.value];
  [arr[itemIndex], arr[to]] = [arr[to]!, arr[itemIndex]!];
  layoutItems.value = arr;
}

const layoutDragFromIndex = ref<number | null>(null);
const layoutDragOverIndex = ref<number | null>(null);
const layoutDropIndex = ref<number | null>(null);

function resetLayoutDragState() {
  layoutDragFromIndex.value = null;
  layoutDragOverIndex.value = null;
  layoutDropIndex.value = null;
}

function onLayoutDragStart(event: DragEvent, index: number) {
  if (!isEditingFormLayout.value) {
    event.preventDefault();
    return;
  }
  layoutDragFromIndex.value = index;
  layoutDragOverIndex.value = null;
  layoutDropIndex.value = null;
  event.dataTransfer?.setData('text/plain', String(index));
  if (event.dataTransfer)
    event.dataTransfer.effectAllowed = 'move';
}

function onLayoutDragOver(event: DragEvent, index: number) {
  if (!isEditingFormLayout.value || layoutDragFromIndex.value === null)
    return;
  event.preventDefault();
  layoutDragOverIndex.value = index;
  const target = event.currentTarget as HTMLElement | null;
  if (target) {
    const rect = target.getBoundingClientRect();
    layoutDropIndex.value = (event.clientY - rect.top) < rect.height / 2 ? index : index + 1;
  }
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'move';
}

function doLayoutReorder(fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0)
    return;
  const arr = [...layoutItems.value];
  const [moved] = arr.splice(fromIndex, 1);
  if (!moved)
    return;
  arr.splice(Math.min(toIndex, arr.length), 0, moved);
  layoutItems.value = arr;
}

function onLayoutDrop(event: DragEvent) {
  if (!isEditingFormLayout.value)
    return;
  event.preventDefault();
  const raw = event.dataTransfer?.getData('text/plain') ?? '';
  const parsed = raw !== '' ? Number.parseInt(raw, 10) : Number.NaN;
  const fromIndex = Number.isFinite(parsed) ? parsed : layoutDragFromIndex.value;
  const toIndex = layoutDropIndex.value;
  if (fromIndex === null || fromIndex === undefined || Number.isNaN(fromIndex) || toIndex === null || toIndex === undefined) {
    resetLayoutDragState();
    return;
  }
  doLayoutReorder(fromIndex, toIndex);
  resetLayoutDragState();
}

function onLayoutDragEnd() {
  resetLayoutDragState();
}

function onGapDragOver(event: DragEvent, gapIndex: number) {
  if (!isEditingFormLayout.value || layoutDragFromIndex.value === null)
    return;
  event.preventDefault();
  layoutDropIndex.value = gapIndex;
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'move';
}

function onGapDrop(event: DragEvent, gapIndex: number) {
  if (!isEditingFormLayout.value)
    return;
  event.preventDefault();
  const raw = event.dataTransfer?.getData('text/plain') ?? '';
  const parsed = raw !== '' ? Number.parseInt(raw, 10) : Number.NaN;
  const fromIndex = Number.isFinite(parsed) ? parsed : layoutDragFromIndex.value;
  if (fromIndex === null || fromIndex === undefined || Number.isNaN(fromIndex)) {
    resetLayoutDragState();
    return;
  }
  // When dragging from before the gap the array shifts by 1 after removal
  const toIndex = fromIndex < gapIndex ? gapIndex - 1 : gapIndex;
  doLayoutReorder(fromIndex, toIndex);
  resetLayoutDragState();
}

// ─── Card class helpers ────────────────────────────────────────────────────
function getFieldCardClass(instanceId: string): string {
  return activeEditingFieldId.value === instanceId
    ? 'rounded-md border border-yellow-300 p-2 bg-yellow-50'
    : 'rounded-md border border-gray-200 p-2 bg-white';
}

function getGroupCardClass(groupId: string): string {
  const group = availableGroups.value.find(g => g.id === groupId);
  const isActive = group ? group.fields.some(f => f.instanceId === activeEditingFieldId.value) : false;
  return isActive
    ? 'rounded-lg border-2 border-yellow-300 p-3 bg-yellow-50'
    : 'rounded-lg border-2 border-indigo-200 p-3 bg-indigo-50/40';
}

// ─── Save / start / cancel ─────────────────────────────────────────────────
async function saveFormLayout(): Promise<boolean> {
  if (!templateId.value)
    return false;
  isSavingFormLayout.value = true;
  try {
    revertSectionTitleIfEmpty();
    let orderCounter = 0;

    type PayloadField = {
      instanceId: string;
      questionLabel: string;
      order: number;
      required: boolean;
      formSuggestionNote?: string;
      groupId?: string;
      groupTitle?: string;
    };
    const fields: PayloadField[] = [];

    for (const item of layoutItems.value) {
      if (item.kind === 'field') {
        orderCounter += 10;
        const fallback = orderedLayoutEditorFieldsById.value.get(item.instanceId);
        fields.push({
          instanceId: item.instanceId,
          questionLabel: String(item.questionLabel || '').trim() || String((fallback as any)?.formQuestionLabel || (fallback as any)?.label || (fallback as any)?.name || ''),
          order: orderCounter,
          required: item.required !== false,
          formSuggestionNote: getFieldSuggestionNote(item.instanceId),
        });
      }
      else {
        const groupTitle = String(item.title || '').trim();
        item.fields.forEach((f) => {
          orderCounter += 10;
          const fallback = orderedLayoutEditorFieldsById.value.get(f.instanceId);
          fields.push({
            instanceId: f.instanceId,
            questionLabel: String(f.questionLabel || '').trim() || String((fallback as any)?.formQuestionLabel || (fallback as any)?.label || (fallback as any)?.name || ''),
            order: orderCounter,
            required: item.required !== false,
            formSuggestionNote: getFieldSuggestionNote(f.instanceId),
            groupId: item.id,
            groupTitle,
          });
        });
        orderCounter += 10;
      }
    }

    // Build entries (new API format)
    const entries: Array<Record<string, unknown>> = [];
    let currentGroupEntry: Record<string, unknown> | null = null;
    const seenGroupIds = new Set<string>();

    for (const f of fields) {
      if (f.groupId) {
        if (!seenGroupIds.has(f.groupId)) {
          seenGroupIds.add(f.groupId);
          currentGroupEntry = { kind: 'group', id: f.groupId, title: f.groupTitle ?? '', required: f.required, order: f.order, fields: [] };
          entries.push(currentGroupEntry);
        }
        (currentGroupEntry!.fields as Array<Record<string, unknown>>).push({ instanceId: f.instanceId, questionLabel: f.questionLabel, formSuggestionNote: f.formSuggestionNote });
      }
      else {
        entries.push({ kind: 'field', instanceId: f.instanceId, questionLabel: f.questionLabel, formSuggestionNote: f.formSuggestionNote, order: f.order, required: f.required });
      }
    }

    const signerSuggestionNotes = signingSteps.value.map(step => ({
      stepId: step.id,
      suggestionNote: getSignerSuggestionNote(step.id),
    }));

    const result = await $fetch<{ success: boolean; data?: { placedFieldsData?: any[] }; error?: string }>(
      `/api/pdf-templates/${templateId.value}/form-layout`,
      { method: 'PATCH', body: { sectionTitle: String(formSectionTitle.value || tr('requestInformation')).trim(), entries, signerSuggestionNotes } },
    );

    if (!result.success)
      throw new Error(result.error || tr('saveLayoutFailed'));

    if (Array.isArray(result.data?.placedFieldsData)) {
      placedFields.value = result.data!.placedFieldsData!;
      syncLayoutItems();
    }
    else {
      await fetchTemplate();
    }

    toast.add({ title: tr('savedTitle'), description: tr('savedLayoutDescription'), color: 'success' });
    return true;
  }
  catch (err) {
    toast.add({ title: tr('errorTitle'), description: err instanceof Error ? err.message : tr('saveLayoutFailed'), color: 'error' });
    return false;
  }
  finally {
    isSavingFormLayout.value = false;
  }
}

function startEditFormLayout() {
  formLayoutEditSnapshot.value = {
    sectionTitle: String(formSectionTitle.value || ''),
    items: layoutItems.value.map(it =>
      it.kind === 'field' ? { ...it } : { ...it, fields: it.fields.map(f => ({ ...f })) },
    ),
  };
  isEditingFormLayout.value = true;
}

async function confirmAndSaveFormLayout() {
  const instance = confirmDialog.open({
    title: tr('confirmSaveTitle'),
    description: tr('confirmSaveDescription'),
    cancelButton: { label: t('cancel') },
    confirmButton: { label: t('saveChanges'), color: 'primary' },
  });
  const confirmed = await instance.result;
  if (!confirmed)
    return;
  const ok = await saveFormLayout();
  if (ok) {
    isEditingFormLayout.value = false;
    activeEditingFieldId.value = null;
    formLayoutEditSnapshot.value = null;
  }
}

async function confirmAndCancelFormLayoutEdit() {
  const instance = confirmDialog.open({
    title: tr('confirmCancelTitle'),
    description: tr('confirmCancelDescription'),
    cancelButton: { label: tr('backToEditing') },
    confirmButton: { label: tr('cancelEditing'), color: 'error' },
  });
  const confirmed = await instance.result;
  if (!confirmed)
    return;
  const snap = formLayoutEditSnapshot.value;
  if (snap) {
    formSectionTitle.value = snap.sectionTitle;
    layoutItems.value = snap.items.map(it =>
      it.kind === 'field' ? { ...it } : { ...it, fields: it.fields.map(f => ({ ...f })) },
    );
  }
  syncLayoutItems();
  isEditingFormLayout.value = false;
  activeEditingFieldId.value = null;
  formLayoutEditSnapshot.value = null;
}

function updatePreviewValue(field: any, value: string) {
  const key = getFieldValueKey(field);
  if (!key) {
    return;
  }
  if (!isCheckboxField(field)) {
    previewFieldValues.value[key] = String(value ?? '');
    return;
  }
  const groupId = String(field?.groupId ?? '').trim();
  const normalized = normalizeCheckboxValue(value);
  if (!groupId) {
    previewFieldValues.value[key] = normalized;
    return;
  }
  if (normalized === 'true') {
    for (const candidate of placedFields.value) {
      if (!isCheckboxField(candidate) || String(candidate?.groupId ?? '').trim() !== groupId) {
        continue;
      }
      const candidateKey = getFieldValueKey(candidate);
      if (!candidateKey) {
        continue;
      }
      previewFieldValues.value[candidateKey] = candidateKey === key ? 'true' : '';
    }
    return;
  }
  previewFieldValues.value[key] = '';
}

function isPreviewCheckboxDisabled(field: any): boolean {
  if (!isCheckboxField(field)) {
    return false;
  }
  const groupId = String(field?.groupId ?? '').trim();
  if (!groupId) {
    return false;
  }
  const currentKey = getFieldValueKey(field);
  const isCurrentChecked = normalizeCheckboxValue(resolveCurrentFieldValue(field)) === 'true';
  if (isCurrentChecked) {
    return false;
  }
  return placedFields.value.some((candidate) => {
    if (!isCheckboxField(candidate) || String(candidate?.groupId ?? '').trim() !== groupId) {
      return false;
    }
    const candidateKey = getFieldValueKey(candidate);
    if (!candidateKey || candidateKey === currentKey) {
      return false;
    }
    return normalizeCheckboxValue(resolveCurrentFieldValue(candidate)) === 'true';
  });
}

function normalizeSigningFlowData(value: unknown): SigningStepSummary[] {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed))
    return [];

  return parsed
    .map((step: any, index: number) => ({
      id: typeof step?.id === 'string' && step.id.trim().length > 0 ? step.id : `step-${index + 1}`,
      order: typeof step?.order === 'number' ? step.order : index + 1,
      roleName: typeof step?.roleName === 'string' && step.roleName.trim().length > 0
        ? step.roleName.trim()
        : tr('signerFallback', { order: index + 1 }),
      suggestionNote: typeof step?.suggestionNote === 'string' && step.suggestionNote.trim().length > 0
        ? step.suggestionNote.trim()
        : null,
      description: typeof step?.description === 'string' && step.description.trim().length > 0
        ? step.description.trim()
        : null,
      isRequired: step?.isRequired !== false,
      color: typeof step?.color === 'string' && step.color.trim().length > 0
        ? step.color
        : DEFAULT_SIGNING_STEP_COLOR,
    }))
    .sort((a, b) => a.order - b.order);
}

// --- Methods ---
async function fetchTemplate() {
  if (!templateId.value) {
    error.value = tr('templateIdRequired');
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    const result = await $fetch<ApiResponse<Template>>(`/api/pdf-templates/${templateId.value}`);

    if (result.success && result.data) {
      template.value = result.data;
      placedFields.value = normalizePlacedFieldsData(result.data.placedFieldsData);
      syncFormFieldLayout();
    }
    else {
      error.value = tr('templateNotFound');
    }
  }
  catch (err) {
    console.error('Error fetching template:', err);
    error.value = err instanceof Error ? err.message : tr('loadTemplateFailed');
  }
  finally {
    isLoading.value = false;
  }
}

function downloadPdf() {
  if (template.value?.documentUrl) {
    window.open(template.value.documentUrl, '_blank');
  }
}

async function deleteTemplate() {
  if (!templateId.value)
    return;

  const instance = confirmDialog.open({
    title: tr('deleteTemplateTitle'),
    description: tr('deleteTemplateDescription', { name: template.value?.name || '-' }),
    cancelButton: { label: t('cancel') },
    confirmButton: { label: t('delete'), color: 'error' },
  });

  const confirmed = await instance.result;
  if (!confirmed)
    return;

  isDeleting.value = true;
  try {
    await $fetch(`/api/pdf-templates/${templateId.value}`, { method: 'DELETE' });
    toast.add({
      title: tr('deletedTitle'),
      description: tr('deletedDescription', { name: template.value?.name || '-' }),
      color: 'success',
    });
    router.push(localePath('/admin/templates'));
  }
  catch (err) {
    console.error('Error deleting template:', err);
    toast.add({
      title: tr('errorTitle'),
      description: tr('deleteTemplateFailed'),
      color: 'error',
    });
  }
  finally {
    isDeleting.value = false;
  }
}

// Local switch state mirrors template.isActive so we can intercept toggles
const switchState = ref<boolean>(false);

watch(
  () => template.value && template.value.isActive,
  (v) => {
    switchState.value = Boolean(v);
  },
  { immediate: true },
);

async function onSwitchChange(newValue: boolean) {
  if (!templateId.value || !template.value) {
    // revert
    switchState.value = false;
    return;
  }

  const prev = Boolean(template.value.isActive);
  const desired = Boolean(newValue);
  if (prev === desired) {
    return;
  }

  const instance = confirmDialog.open({
    title: desired ? tr('enableTemplateTitle') : tr('disableTemplateTitle'),
    description: tr('toggleTemplateDescription', {
      action: desired ? tr('enableAction') : tr('disableAction'),
      name: template.value.name || '-',
    }),
    cancelButton: { label: t('cancel') },
    confirmButton: { label: desired ? tr('enableAction') : tr('disableAction'), color: desired ? 'primary' : 'error' },
  });

  const confirmed = await instance.result;
  if (!confirmed) {
    // revert UI
    switchState.value = prev;
    return;
  }

  try {
    await $fetch(`/api/pdf-templates/${templateId.value}/active`, {
      method: 'PATCH',
      body: { isActive: desired },
    });

    template.value.isActive = desired;
    switchState.value = desired;
    toast.add({ title: desired ? tr('enabledSuccess') : tr('disabledSuccess'), color: 'success' });
  }
  catch (err) {
    console.error('Failed to update template active state:', err);
    switchState.value = prev;
    toast.add({ title: tr('errorTitle'), description: err instanceof Error ? err.message : tr('toggleTemplateFailed'), color: 'error' });
  }
}

onMounted(() => {
  fetchTemplate();
});

watch(layoutEditorFillableFields, () => {
  if (isEditingFormLayout.value) {
    return;
  }
  syncFormFieldLayout();
}, { deep: true });
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header with Breadcrumb -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <UBreadcrumb
          :links="[
            { label: t('allTemplates'), to: localePath('/admin/templates') },
            { label: template?.name || tr('loading'), to: templateId ? localePath(`/admin/templates/${templateId}`) : localePath('/admin/templates') },
          ]"
        />
        <div class="mt-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ template?.name || tr('documentPreview') }}
            </h1>
            <p class="mt-1 text-sm text-gray-500">
              {{ templateDescriptionPreview }}
            </p>
          </div>
          <div class="flex gap-4 items-center">
            <div class="flex items-center gap-3">
              <template v-if="authStore.can('template.edit')">
                <button
                  type="button"
                  role="switch"
                  :aria-checked="switchState"
                  class="inline-flex items-center gap-3 rounded-full border-2 px-3 py-1 focus:outline-none focus:ring-2 focus:ring-offset-1"
                  :class="switchState ? 'bg-green-50 border-green-200 hover:bg-green-100 focus:ring-green-200' : 'bg-red-50 border-red-200 hover:bg-red-100 focus:ring-red-200'"
                  @click="onSwitchChange(!switchState)"
                >
                  <span class="sr-only">{{ tr('toggleTemplateActive') }}</span>

                  <!-- Track + sliding knob -->
                  <span class="relative inline-block w-14 h-7 rounded-full p-1">
                    <!-- visible track line so user knows it's a slider -->
                    <span class="absolute inset-0 flex items-center justify-center">
                      <span class="w-8 h-0.5 rounded-full bg-gray-400" />
                    </span>

                    <span
                      class="absolute top-1 left-1 w-5 h-5 rounded-full shadow transform transition-transform duration-150 border-2 border-white"
                      :class="switchState ? 'translate-x-6 bg-green-500' : 'translate-x-0 bg-red-500'"
                    />
                  </span>

                  <span :class="switchState ? 'text-green-600 font-semibold text-sm' : 'text-red-600 font-semibold text-sm'">
                    {{ switchState ? tr('active') : tr('inactive') }}
                  </span>
                </button>
              </template>
              <template v-else>
                <div class="inline-flex items-center gap-3">
                  <div class="h-7 w-16 rounded-full p-1" :class="[switchState ? 'bg-green-500' : 'bg-red-500']">
                    <span class="block w-6 h-6 bg-white rounded-full shadow" :class="switchState ? 'ml-8' : 'ml-0'" />
                  </div>
                  <span class="text-sm font-medium text-gray-700">{{ switchState ? tr('active') : tr('inactive') }}</span>
                </div>
              </template>
            </div>
            <UButton
              icon="i-heroicons-arrow-down-tray"
              variant="ghost"
              color="neutral"
              @click="downloadPdf"
            />
            <UButton
              v-if="authStore.can('template.delete')"
              icon="i-heroicons-trash"
              variant="ghost"
              color="error"
              :loading="isDeleting"
              @click="deleteTemplate"
            />
            <UButton
              v-if="authStore.can('template.edit')"
              :to="`/admin/templates/edit?id=${templateId}`"
              icon="i-heroicons-pencil-square"
              variant="solid"
            >
              {{ tr('editTemplate') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center h-96">
        <div class="text-center">
          <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4" />
          <p class="text-gray-500">
            {{ tr('loadingTemplate') }}
          </p>
        </div>
      </div>

      <!-- Error State -->
      <UCard v-else-if="error">
        <div class="text-center py-8">
          <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4" />
          <p class="text-red-600 mb-4">
            {{ error }}
          </p>
          <UButton @click="$router.push(localePath('/admin/templates'))">
            {{ tr('backToTemplates') }}
          </UButton>
        </div>
      </UCard>

      <!-- Template Content -->
      <div v-else-if="template && template.documentUrl" class="grid grid-cols-1 gap-5 items-start lg:grid-cols-[minmax(0,1.7fr)_minmax(24rem,1fr)]">
        <!-- Left: PDF Preview (sticky on large screens while editing the form column) -->
        <div
          class="lg:sticky lg:top-4 lg:z-10 lg:max-h-[min(100vh-5rem,100dvh-5rem)] lg:overflow-y-auto lg:pr-1 lg:-ml-1 lg:pl-0"
        >
          <template-pdf-preview
            :pdf-url="template.documentUrl"
            :placed-fields="placedFields"
            :highlighted-field-instance-id="activeEditingFieldId || ''"
            :interactive-fields="true"
            @field-clicked="focusLayoutInputByInstanceId"
          />
        </div>

        <!-- Right: Sidebar -->
        <div class="space-y-6">
          <!-- Request Summary -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold text-gray-500 uppercase">
                  {{ tr('formLayoutStudentView') }}
                </h3>
                <div class="flex items-center gap-1 justify-end">
                  <template v-if="!isEditingFormLayout">
                    <UButton
                      size="xs"
                      variant="ghost"
                      icon="i-heroicons-pencil-square"
                      @click="startEditFormLayout"
                    >
                      {{ tr('editLayout') }}
                    </UButton>
                  </template>
                  <template v-else>
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      icon="i-heroicons-x-mark"
                      :disabled="isSavingFormLayout"
                      @click="confirmAndCancelFormLayoutEdit"
                    >
                      {{ t('cancel') }}
                    </UButton>
                    <UButton
                      size="xs"
                      color="primary"
                      icon="i-heroicons-check"
                      :loading="isSavingFormLayout"
                      @click="confirmAndSaveFormLayout"
                    >
                      {{ tr('saveLayout') }}
                    </UButton>
                  </template>
                </div>
              </div>
            </template>
            <div class="space-y-3 w-full">
              <div>
                <label class="text-xs font-semibold text-gray-500 uppercase mb-1 block">{{ tr('sectionTitle') }}</label>
                <UInput
                  v-model="formSectionTitle"
                  :disabled="!isEditingFormLayout"
                  @blur="revertSectionTitleIfEmpty"
                />
              </div>

              <div class="rounded-lg border border-gray-200 p-3">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">
                  {{ formSectionTitle || tr('requestInformation') }}
                </h4>
                <div class="space-y-3">
                  <template
                    v-for="(item, itemIndex) in layoutItems"
                    :key="item.kind === 'field' ? `field-${item.instanceId}` : `group-${item.id}`"
                  >
                    <!-- Gap between items: drop zone during drag, + button on hover -->
                    <div
                      v-if="isEditingFormLayout"
                      class="group/gap relative flex items-center z-20"
                      :class="layoutDragFromIndex !== null ? 'h-8 -my-4 cursor-copy' : 'h-4 -my-2 pointer-events-none'"
                      @dragover="onGapDragOver($event, itemIndex)"
                      @drop="onGapDrop($event, itemIndex)"
                    >
                      <div
                        class="flex-1 transition-all duration-150 rounded"
                        :class="layoutDropIndex === itemIndex && layoutDragFromIndex !== null
                          ? 'h-1 bg-indigo-500 shadow'
                          : 'h-px bg-gray-200 group-hover/gap:bg-indigo-400'"
                      />
                      <button
                        v-if="layoutDragFromIndex === null"
                        type="button"
                        class="pointer-events-auto opacity-0 group-hover/gap:opacity-100 transition-opacity shrink-0 w-6 h-6 rounded-full bg-white border-2 border-indigo-400 text-indigo-500 flex items-center justify-center text-sm font-bold hover:bg-indigo-50 leading-none"
                        :title="tr('addGroupHere')"
                        @click.stop="addGroupAt(itemIndex)"
                      >
                        +
                      </button>
                      <div
                        class="flex-1 transition-all duration-150 rounded"
                        :class="layoutDropIndex === itemIndex && layoutDragFromIndex !== null
                          ? 'h-1 bg-indigo-500 shadow'
                          : 'h-px bg-gray-200 group-hover/gap:bg-indigo-400'"
                      />
                    </div>

                    <!-- ── Individual field card ── -->
                    <div
                      v-if="item.kind === 'field'"
                      :id="`form-layout-row-${item.instanceId}`"
                      :class="[
                        getFieldCardClass(item.instanceId),
                        isEditingFormLayout && layoutDragFromIndex === itemIndex ? 'layout-row-dragging' : '',
                      ]"
                      @dragover="onLayoutDragOver($event, itemIndex)"
                      @drop="onLayoutDrop"
                    >
                      <div class="flex items-center gap-2 mb-2">
                        <button
                          v-if="isEditingFormLayout"
                          type="button"
                          class="layout-drag-handle shrink-0 flex items-center justify-center w-8 h-8 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-grab active:cursor-grabbing touch-manipulation"
                          :title="tr('dragToReorder')"
                          :aria-label="tr('dragToReorderQuestion')"
                          draggable="true"
                          @dragstart="onLayoutDragStart($event, itemIndex)"
                          @dragend="onLayoutDragEnd"
                        >
                          <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
                        </button>
                        <UInput
                          :model-value="item.questionLabel"
                          :disabled="!isEditingFormLayout"
                          class="flex-1 min-w-0"
                          @focus="activeEditingFieldId = item.instanceId"
                          @blur="() => { activeEditingFieldId = null; revertQuestionLabelIfEmpty(item.instanceId); }"
                          @update:model-value="(value) => setQuestionLabel(item.instanceId, String(value ?? ''))"
                        />
                        <UButton
                          size="xs"
                          icon="i-heroicons-chevron-up"
                          variant="ghost"
                          :disabled="!isEditingFormLayout || itemIndex === 0"
                          @click="moveLayoutItem(itemIndex, -1)"
                        />
                        <UButton
                          size="xs"
                          icon="i-heroicons-chevron-down"
                          variant="ghost"
                          :disabled="!isEditingFormLayout || itemIndex === layoutItems.length - 1"
                          @click="moveLayoutItem(itemIndex, 1)"
                        />
                      </div>
                      <div
                        v-if="isEditingFormLayout"
                        class="flex items-center gap-3 mb-2 flex-wrap"
                      >
                        <UCheckbox
                          :model-value="item.required"
                          :label="tr('required')"
                          @update:model-value="(v) => setLayoutRequired(item.instanceId, Boolean(v))"
                        />
                        <div v-if="availableGroups.length > 0" class="flex items-center gap-1">
                          <span class="text-xs text-gray-500">{{ tr('moveToGroup') }}</span>
                          <select
                            class="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                            @change="(e) => { const v = (e.target as HTMLSelectElement).value; if (v) assignFieldToGroup(item.instanceId, v); (e.target as HTMLSelectElement).value = ''; }"
                          >
                            <option value="">
                              {{ tr('selectGroupOption') }}
                            </option>
                            <option v-for="g in availableGroups" :key="g.id" :value="g.id">
                              {{ g.title || tr('untitledGroup') }}
                            </option>
                          </select>
                        </div>
                      </div>
                      <div v-if="isEditingFormLayout" class="mb-2">
                        <label class="text-xs text-gray-500 mb-1 block">{{ tr('suggestionNote') }}</label>
                        <UTextarea
                          :model-value="getFieldSuggestionNote(item.instanceId)"
                          :rows="2"
                          :maxlength="SUGGESTION_NOTE_MAX_LENGTH"
                          :placeholder="tr('studentSuggestionPlaceholder')"
                          @update:model-value="(value) => setFieldSuggestionNote(item.instanceId, String(value ?? ''))"
                        />
                        <p class="mt-1 text-[11px] text-gray-500 text-right">
                          {{ getFieldSuggestionNote(item.instanceId).length }}/{{ SUGGESTION_NOTE_MAX_LENGTH }}
                        </p>
                      </div>
                      <form-field-input
                        v-if="isFieldVisible(orderedLayoutEditorFieldsById.get(item.instanceId))"
                        :model-value="previewFieldValues[getFieldValueKey(orderedLayoutEditorFieldsById.get(item.instanceId))]"
                        :field="{ ...orderedLayoutEditorFieldsById.get(item.instanceId), label: item.questionLabel, formRequired: getPreviewFormRequired(orderedLayoutEditorFieldsById.get(item.instanceId)) }"
                        :disabled="isPreviewCheckboxDisabled(orderedLayoutEditorFieldsById.get(item.instanceId))"
                        @update:model-value="(value) => updatePreviewValue(orderedLayoutEditorFieldsById.get(item.instanceId), String(value ?? ''))"
                      />
                      <p
                        v-else-if="orderedLayoutEditorFieldsById.get(item.instanceId)"
                        class="text-xs text-gray-500 px-2 py-2 rounded border border-dashed border-gray-200 bg-gray-50/80"
                      >
                        {{ tr('hiddenByConditionHint') }}
                      </p>
                    </div>

                    <!-- ── Group card ── -->
                    <div
                      v-else-if="item.kind === 'group'"
                      :id="`form-layout-group-${item.id}`"
                      :class="[
                        getGroupCardClass(item.id),
                        isEditingFormLayout && layoutDragFromIndex === itemIndex ? 'layout-row-dragging' : '',
                      ]"
                      @dragover="onLayoutDragOver($event, itemIndex)"
                      @drop="onLayoutDrop"
                    >
                      <!-- Group header: title input + reorder + delete -->
                      <div class="flex items-center gap-2 mb-2">
                        <button
                          v-if="isEditingFormLayout"
                          type="button"
                          class="layout-drag-handle shrink-0 flex items-center justify-center w-8 h-8 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-grab active:cursor-grabbing touch-manipulation"
                          :title="tr('dragToReorder')"
                          :aria-label="tr('dragToReorderGroup')"
                          draggable="true"
                          @dragstart="onLayoutDragStart($event, itemIndex)"
                          @dragend="onLayoutDragEnd"
                        >
                          <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
                        </button>
                        <UInput
                          v-model="item.title"
                          :disabled="!isEditingFormLayout"
                          class="flex-1 min-w-0"
                          :placeholder="tr('groupTitlePlaceholder')"
                          @focus="activeEditingFieldId = item.fields[0] ? item.fields[0].instanceId : null"
                        />
                        <UButton
                          size="xs"
                          icon="i-heroicons-chevron-up"
                          variant="ghost"
                          :disabled="!isEditingFormLayout || itemIndex === 0"
                          @click="moveLayoutItem(itemIndex, -1)"
                        />
                        <UButton
                          size="xs"
                          icon="i-heroicons-chevron-down"
                          variant="ghost"
                          :disabled="!isEditingFormLayout || itemIndex === layoutItems.length - 1"
                          @click="moveLayoutItem(itemIndex, 1)"
                        />
                        <UButton
                          v-if="isEditingFormLayout"
                          size="xs"
                          icon="i-heroicons-trash"
                          variant="ghost"
                          color="error"
                          :title="tr('removeGroupAndReturnFields')"
                          @click="removeGroup(item.id)"
                        />
                      </div>

                      <!-- Required toggle -->
                      <div
                        v-if="isEditingFormLayout"
                        class="flex items-center gap-2 mb-2"
                      >
                        <UCheckbox
                          :model-value="item.required"
                          :label="tr('required')"
                          @update:model-value="(v) => setGroupRequired(item.id, Boolean(v))"
                        />
                      </div>

                      <!-- Group title in preview mode -->
                      <div v-if="!isEditingFormLayout && item.title" class="text-sm font-medium text-gray-700 flex items-center gap-0.5 mb-2">
                        <span>{{ item.title }}</span>
                        <abbr v-if="item.required" class="text-red-500 no-underline ml-0.5 font-semibold" :title="tr('required')">*</abbr>
                      </div>

                      <!-- Fields inside group -->
                      <div class="space-y-2 pl-2 border-l-2 border-indigo-200">
                        <div
                          v-for="(groupField, fi) in item.fields"
                          :key="groupField.instanceId"
                          class="rounded border border-gray-200 p-2 bg-white"
                        >
                          <div class="flex items-center gap-2 mb-1">
                            <UInput
                              :model-value="groupField.questionLabel"
                              :disabled="!isEditingFormLayout"
                              class="flex-1 min-w-0"
                              @focus="activeEditingFieldId = groupField.instanceId"
                              @blur="() => { activeEditingFieldId = null; revertQuestionLabelIfEmpty(groupField.instanceId); }"
                              @update:model-value="(value) => setQuestionLabel(groupField.instanceId, String(value ?? ''))"
                            />
                            <UButton
                              v-if="isEditingFormLayout"
                              size="xs"
                              icon="i-heroicons-chevron-up"
                              variant="ghost"
                              :disabled="fi === 0"
                              @click="moveFieldInGroup(item.id, fi, -1)"
                            />
                            <UButton
                              v-if="isEditingFormLayout"
                              size="xs"
                              icon="i-heroicons-chevron-down"
                              variant="ghost"
                              :disabled="fi === item.fields.length - 1"
                              @click="moveFieldInGroup(item.id, fi, 1)"
                            />
                            <UButton
                              v-if="isEditingFormLayout"
                              size="xs"
                              icon="i-heroicons-arrow-uturn-left"
                              variant="ghost"
                              color="neutral"
                              :title="tr('removeFromGroup')"
                              @click="removeFieldFromGroup(item.id, groupField.instanceId)"
                            />
                          </div>
                          <div v-if="isEditingFormLayout" class="mb-2">
                            <label class="text-xs text-gray-500 mb-1 block">{{ tr('suggestionNote') }}</label>
                            <UTextarea
                              :model-value="getFieldSuggestionNote(groupField.instanceId)"
                              :rows="2"
                              :maxlength="SUGGESTION_NOTE_MAX_LENGTH"
                              :placeholder="tr('studentSuggestionPlaceholder')"
                              @update:model-value="(value) => setFieldSuggestionNote(groupField.instanceId, String(value ?? ''))"
                            />
                            <p class="mt-1 text-[11px] text-gray-500 text-right">
                              {{ getFieldSuggestionNote(groupField.instanceId).length }}/{{ SUGGESTION_NOTE_MAX_LENGTH }}
                            </p>
                          </div>
                          <form-field-input
                            v-if="isFieldVisible(orderedLayoutEditorFieldsById.get(groupField.instanceId))"
                            :model-value="previewFieldValues[getFieldValueKey(orderedLayoutEditorFieldsById.get(groupField.instanceId))]"
                            :field="{ ...orderedLayoutEditorFieldsById.get(groupField.instanceId), label: groupField.questionLabel, formRequired: getPreviewFormRequired(orderedLayoutEditorFieldsById.get(groupField.instanceId)) }"
                            :disabled="isPreviewCheckboxDisabled(orderedLayoutEditorFieldsById.get(groupField.instanceId))"
                            @update:model-value="(value) => updatePreviewValue(orderedLayoutEditorFieldsById.get(groupField.instanceId), String(value ?? ''))"
                          />
                          <p
                            v-else-if="orderedLayoutEditorFieldsById.get(groupField.instanceId)"
                            class="text-xs text-gray-500 px-2 py-2 rounded border border-dashed border-gray-200 bg-gray-50/80"
                          >
                            {{ tr('hiddenByConditionHint') }}
                          </p>
                        </div>

                        <!-- Add field to group -->
                        <div v-if="isEditingFormLayout" class="mt-1">
                          <select
                            class="text-xs border border-gray-200 rounded px-2 py-1 bg-white w-full"
                            @change="(e) => { const v = (e.target as HTMLSelectElement).value; if (v) assignFieldToGroup(v, item.id); (e.target as HTMLSelectElement).value = ''; }"
                          >
                            <option value="">
                              {{ tr('addFieldToThisGroup') }}
                            </option>
                            <option
                              v-for="standaloneItem in layoutItems.filter(it => it.kind === 'field')"
                              :key="(standaloneItem as any).instanceId"
                              :value="(standaloneItem as any).instanceId"
                            >
                              {{ (standaloneItem as any).questionLabel || orderedLayoutEditorFieldsById.get((standaloneItem as any).instanceId)?.label || (standaloneItem as any).instanceId }}
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- End-of-list drop zone (for dragging to last position) + hover + button -->
                  <div class="relative">
                    <!-- Drop zone strip: only active during drag -->
                    <div
                      v-if="isEditingFormLayout && layoutDragFromIndex !== null"
                      class="absolute inset-x-0 -top-4 h-8 z-20"
                      @dragover="onGapDragOver($event, layoutItems.length)"
                      @drop="onGapDrop($event, layoutItems.length)"
                    />
                    <!-- Visual line and + button -->
                    <div
                      v-if="isEditingFormLayout"
                      class="group/gap relative flex items-center h-4 -mt-2 z-10 pointer-events-none"
                    >
                      <div
                        class="flex-1 h-px transition-colors duration-150"
                        :class="layoutDropIndex === layoutItems.length && layoutDragFromIndex !== null
                          ? 'bg-indigo-500'
                          : 'bg-gray-200 group-hover/gap:bg-indigo-400'"
                      />
                      <button
                        v-if="layoutDragFromIndex === null"
                        type="button"
                        class="pointer-events-auto opacity-0 group-hover/gap:opacity-100 transition-opacity shrink-0 w-6 h-6 rounded-full bg-white border-2 border-indigo-400 text-indigo-500 flex items-center justify-center text-sm font-bold hover:bg-indigo-50 leading-none"
                        :title="tr('addGroupHere')"
                        @click.stop="addGroupAt(layoutItems.length)"
                      >
                        +
                      </button>
                      <div
                        class="flex-1 h-px transition-colors duration-150"
                        :class="layoutDropIndex === layoutItems.length && layoutDragFromIndex !== null
                          ? 'bg-indigo-500'
                          : 'bg-gray-200 group-hover/gap:bg-indigo-400'"
                      />
                    </div>
                  </div>
                  <p v-if="layoutItems.length === 0" class="text-sm text-gray-400 text-center py-3">
                    {{ tr('noStudentFillableFields') }}
                  </p>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Workflow Progress -->
          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                {{ tr('signingOrder') }}
              </h3>
            </template>
            <div v-if="signingSteps.length === 0" class="text-sm text-gray-500">
              {{ tr('noSigningOrderConfigured') }}
            </div>
            <div v-else class="space-y-0">
              <template
                v-for="(step, index) in signingSteps"
                :key="step.id"
              >
                <div class="flex items-start gap-3 py-2">
                  <div
                    class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-semibold"
                    :style="{ backgroundColor: step.color }"
                  >
                    {{ step.order }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">
                      {{ step.roleName }}
                    </p>
                    <p v-if="step.description" class="text-xs text-gray-500 mt-1">
                      {{ step.description }}
                    </p>
                    <UBadge
                      :color="step.isRequired ? 'primary' : 'neutral'"
                      variant="subtle"
                      size="xs"
                      class="mt-1"
                    >
                      {{ step.isRequired ? t('required') : t('optional') }}
                    </UBadge>
                    <div v-if="isEditingFormLayout" class="mt-2">
                      <label class="text-xs text-gray-500 mb-1 block">{{ tr('suggestionNote') }}</label>
                      <UTextarea
                        :model-value="getSignerSuggestionNote(step.id)"
                        :rows="2"
                        :maxlength="SUGGESTION_NOTE_MAX_LENGTH"
                        :placeholder="tr('signerSuggestionPlaceholder')"
                        class="w-full"
                        @update:model-value="(value) => setSignerSuggestionNote(step.id, String(value ?? ''))"
                      />
                      <p class="mt-1 text-[11px] text-gray-500 text-right">
                        {{ getSignerSuggestionNote(step.id).length }}/{{ SUGGESTION_NOTE_MAX_LENGTH }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Arrow between items -->
                <div
                  v-if="index < signingSteps.length - 1"
                  class="flex items-center gap-3"
                >
                  <div class="w-10 flex justify-center">
                    <UIcon
                      name="i-heroicons-arrow-down"
                      class="text-gray-400 text-sm"
                    />
                  </div>
                </div>
              </template>
            </div>
          </UCard>

          <!-- Staff Comments -->
          <!-- <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Staff Comments
              </h3>
            </template>
            <UTextarea
              v-model="staffComment"
              placeholder="Add a note or reason for rejection..."
              :rows="4"
            />
          </UCard> -->

          <!-- Action Buttons -->
          <!-- <div class="space-y-3">
            <UButton
              block
              color="error"
              variant="outline"
              icon="i-heroicons-x-circle"
              @click="handleReject"
            >
              Reject Request
            </UButton>
            <UButton
              block
              color="success"
              icon="i-heroicons-pencil-square"
              @click="handleApprove"
            >
              Sign and Approve
            </UButton>
          </div> -->

          <!-- Footer Note -->
          <!-- <UCard>
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-information-circle" class="text-blue-500 mt-0.5 shrink-0" />
              <p class="text-xs text-gray-600">
                By signing, you confirm that you have reviewed all attached evidence and queries of the grade change request.
              </p>
            </div>
          </UCard> -->
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout-drag-handle {
  -webkit-user-select: none;
  user-select: none;
}

.layout-row-dragging {
  opacity: 0.65;
}

.layout-drop-divider {
  height: 50px;
  border-radius: 9999px;
  border: 2px dashed #3b82f6;
  background-color: rgba(239, 246, 255, 0.95);
  margin: 0.25rem 0;
}
</style>
