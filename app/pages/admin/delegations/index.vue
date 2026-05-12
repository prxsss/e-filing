<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import { LazyBaseConfirmDialog } from '#components';
import { h, resolveComponent } from 'vue';

definePageMeta({
  title: 'adminDelegations.title',
  middleware: ['permission'],
  permission: 'faculty.view',
});

const UButton = resolveComponent('UButton');
const UBadge = resolveComponent('UBadge');

const { locale, t } = useI18n();
const toast = useToast();
const overlay = useOverlay();
const authStore = useAuthStore();
const canEdit = computed(() => authStore.can('faculty.edit'));

const confirmDialog = overlay.create(LazyBaseConfirmDialog);

// ── Data ──────────────────────────────────────────────────────────────────
type DelegationItem = {
  id: number;
  facultyId: number;
  facultyNameEn: string;
  facultyNameTh: string;
  delegateUserId: string;
  delegateNameEn: string;
  delegateNameTh: string;
  delegateEmail: string;
  allowedTemplateIds: number[];
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  note: string | null;
  createdAt: string;
};

const { data, status, refresh } = await useFetch('/api/admin/delegations');
const rows = computed<DelegationItem[]>(() => (data.value?.rows as DelegationItem[]) ?? []);
const isLoading = computed(() => status.value === 'pending');

// ── Faculties (for form select) ───────────────────────────────────────────
const { data: facultiesData } = await useFetch('/api/admin/faculties', { query: { pageSize: 100 } });
const facultyOptions = computed(() =>
  (facultiesData.value?.rows ?? []).map((f: any) => ({
    label: locale.value === 'th' ? f.nameTh : f.nameEn,
    value: f.id,
  })),
);

// ── Templates (for form select) ───────────────────────────────────────────
const { data: templatesData } = await useFetch('/api/pdf-templates', { query: { pageSize: 100 } });
const templateOptions = computed(() =>
  (templatesData.value?.data ?? []).map((tpl: any) => ({
    label: tpl.name ?? `Template #${tpl.id}`,
    value: tpl.id,
  })),
);

// ── Users with any role (for delegate select) ─────────────────────────────
const { data: usersData } = await useFetch('/api/admin/delegations/users', { query: { pageSize: 200 } });
const userOptions = computed(() =>
  (usersData.value?.rows ?? []).map((u: any) => ({
    label: locale.value === 'th' ? (u.fullNameTh || u.fullNameEn) : (u.fullNameEn || u.fullNameTh),
    description: u.email,
    value: u.id,
  })),
);

function toDateTimeLocalValue(dateStr: string | null): string | null {
  if (!dateStr)
    return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime()))
    return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoDateTimeValue(dateStr: string | null): string | null {
  if (!dateStr)
    return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime()))
    return null;
  return date.toISOString();
}

// ── Modal state ───────────────────────────────────────────────────────────
const isModalOpen = ref(false);
const isEditing = ref(false);
const isSaving = ref(false);
const editingId = ref<number | null>(null);

const formState = reactive({
  facultyId: null as number | null,
  delegateUserId: '' as string,
  allowedTemplateIds: [] as number[],
  startDate: null as string | null,
  endDate: null as string | null,
  active: true,
  note: '',
});

const startDateInput = computed<string | undefined>({
  get: () => formState.startDate ?? undefined,
  set: value => formState.startDate = value ?? null,
});

const endDateInput = computed<string | undefined>({
  get: () => formState.endDate ?? undefined,
  set: value => formState.endDate = value ?? null,
});

function openCreateModal() {
  isEditing.value = false;
  editingId.value = null;
  formState.facultyId = null;
  formState.delegateUserId = '';
  formState.allowedTemplateIds = [];
  formState.startDate = null;
  formState.endDate = null;
  formState.active = true;
  formState.note = '';
  isModalOpen.value = true;
}

function openEditModal(item: DelegationItem) {
  isEditing.value = true;
  editingId.value = item.id;
  formState.facultyId = item.facultyId;
  formState.delegateUserId = item.delegateUserId;
  formState.allowedTemplateIds = [...item.allowedTemplateIds];
  formState.startDate = toDateTimeLocalValue(item.startDate);
  formState.endDate = toDateTimeLocalValue(item.endDate);
  formState.active = item.active;
  formState.note = item.note ?? '';
  isModalOpen.value = true;
}

async function saveForm() {
  if (!formState.facultyId || !formState.delegateUserId) {
    toast.add({ title: t('adminDelegations.error.required'), color: 'error' });
    return;
  }

  isSaving.value = true;
  try {
    const payload = {
      facultyId: formState.facultyId,
      delegateUserId: formState.delegateUserId,
      allowedTemplateIds: formState.allowedTemplateIds,
      startDate: toIsoDateTimeValue(formState.startDate),
      endDate: toIsoDateTimeValue(formState.endDate),
      active: formState.active,
      note: formState.note || null,
    };

    if (isEditing.value && editingId.value) {
      await $fetch(`/api/admin/delegations/${editingId.value}`, { method: 'PUT', body: payload });
      toast.add({ title: t('adminDelegations.success.updated'), color: 'success' });
    }
    else {
      await $fetch('/api/admin/delegations', { method: 'POST', body: payload });
      toast.add({ title: t('adminDelegations.success.created'), color: 'success' });
    }

    isModalOpen.value = false;
    await refresh();
  }
  catch (err: any) {
    toast.add({
      title: isEditing.value ? t('adminDelegations.error.updateError') : t('adminDelegations.error.createError'),
      description: err?.data?.message ?? err?.message,
      color: 'error',
    });
  }
  finally {
    isSaving.value = false;
  }
}

// ── Delete ────────────────────────────────────────────────────────────────
const deletingId = ref<number | null>(null);

async function handleDelete(item: DelegationItem) {
  const delegateName = locale.value === 'th' ? item.delegateNameTh : item.delegateNameEn;
  const facultyName = locale.value === 'th' ? item.facultyNameTh : item.facultyNameEn;

  const instance = confirmDialog.open({
    title: t('common.dialog.confirmDelete'),
    description: t('adminDelegations.deleteConfirm', { delegate: delegateName, faculty: facultyName }),
    cancelButton: { label: t('common.actions.cancel') },
    confirmButton: { label: t('common.actions.delete'), color: 'error' },
  });

  const shouldDelete = await instance.result;
  if (!shouldDelete)
    return;

  try {
    deletingId.value = item.id;
    await $fetch(`/api/admin/delegations/${item.id}`, { method: 'DELETE' });
    toast.add({ title: t('adminDelegations.success.deleted'), color: 'success' });
    await refresh();
  }
  catch (err: any) {
    toast.add({
      title: t('adminDelegations.error.deleteError'),
      description: err?.data?.message ?? err?.message,
      color: 'error',
    });
  }
  finally {
    deletingId.value = null;
  }
}

// ── Format dates ──────────────────────────────────────────────────────────
function formatDate(dateStr: string | null): string {
  if (!dateStr)
    return '—';
  return new Date(dateStr).toLocaleDateString(locale.value === 'th' ? 'th-TH' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ── Table columns ─────────────────────────────────────────────────────────
const columns: TableColumn<DelegationItem>[] = [
  {
    id: 'no',
    header: t('common.table.no'),
    cell: ({ row }) => String(row.index + 1),
  },
  {
    accessorKey: 'faculty',
    header: t('common.table.faculty'),
    cell: ({ row }) => locale.value === 'th' ? row.original.facultyNameTh : row.original.facultyNameEn,
  },
  {
    accessorKey: 'delegate',
    header: t('adminDelegations.columns.delegate'),
    cell: ({ row }) => {
      const name = locale.value === 'th' ? row.original.delegateNameTh : row.original.delegateNameEn;
      return h('div', null, [
        h('div', { class: 'font-medium' }, name),
        h('div', { class: 'text-sm text-muted' }, row.original.delegateEmail),
      ]);
    },
  },
  {
    accessorKey: 'allowedTemplates',
    header: t('adminDelegations.columns.allowedTemplates'),
    cell: ({ row }) => {
      const ids = row.original.allowedTemplateIds;
      if (!ids || ids.length === 0) {
        return h(UBadge, { variant: 'soft', color: 'primary' }, { default: () => t('adminDelegations.allTemplates') });
      }
      return h('div', { class: 'flex flex-wrap gap-1' }, ids.map(id => h(UBadge, { key: id, variant: 'soft', color: 'neutral' }, { default: () => `#${id}` })));
    },
  },
  {
    accessorKey: 'period',
    header: t('adminDelegations.columns.period'),
    cell: ({ row }) => {
      const start = formatDate(row.original.startDate);
      const end = formatDate(row.original.endDate);
      if (start === '—' && end === '—') {
        return h('span', { class: 'text-muted text-sm' }, t('adminDelegations.indefinite'));
      }
      return h('div', { class: 'text-sm' }, `${start} – ${end}`);
    },
  },
  {
    accessorKey: 'active',
    header: t('common.table.status'),
    cell: ({ row }) => h(
      UBadge,
      { variant: 'soft', color: row.original.active ? 'success' : 'neutral' },
      { default: () => row.original.active ? t('adminDelegations.active') : t('adminDelegations.inactive') },
    ),
  },
  {
    id: 'actions',
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) => {
      if (!canEdit.value) {
        return null;
      }
      return h('div', { class: 'flex items-center justify-end gap-2' }, [
        h(UButton, {
          color: 'primary',
          variant: 'ghost',
          icon: 'i-lucide-pencil',
          onClick: () => openEditModal(row.original),
        }),
        h(UButton, {
          color: 'error',
          variant: 'ghost',
          icon: 'i-lucide-trash-2',
          loading: deletingId.value === row.original.id,
          disabled: deletingId.value === row.original.id,
          onClick: () => handleDelete(row.original),
        }),
      ]);
    },
  },
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-2xl font-bold mb-1">
          {{ t('adminDelegations.title') }}
        </h1>
        <p class="text-muted">
          {{ t('adminDelegations.description') }}
        </p>
      </div>
      <UButton v-if="canEdit" icon="i-lucide-plus" size="md" @click="openCreateModal">
        {{ t('adminDelegations.addButton') }}
      </UButton>
    </div>

    <UCard>
      <UTable :data="rows" :columns="columns" :loading="isLoading" class="flex-1" />
    </UCard>

    <!-- Create / Edit Modal -->
    <UModal v-model:open="isModalOpen" :title="isEditing ? t('adminDelegations.editTitle') : t('adminDelegations.createTitle')">
      <template #body>
        <div class="space-y-4 p-1">
          <UFormField :label="t('common.form.faculty')" required>
            <USelect
              v-model="formState.facultyId"
              :items="facultyOptions"
              value-key="value"
              label-key="label"
              :disabled="isSaving"
              :placeholder="t('adminDelegations.form.facultyPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('adminDelegations.form.delegate')" required>
            <USelect
              v-model="formState.delegateUserId"
              :items="userOptions"
              value-key="value"
              label-key="label"
              :disabled="isSaving"
              :placeholder="t('adminDelegations.form.delegatePlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('adminDelegations.form.allowedTemplates')">
            <USelectMenu
              v-model="formState.allowedTemplateIds"
              :items="templateOptions"
              value-key="value"
              label-key="label"
              multiple
              :disabled="isSaving"
              :placeholder="t('adminDelegations.form.allTemplatesPlaceholder')"
              class="w-full"
            />
            <template #hint>
              <span class="text-xs text-muted">{{ t('adminDelegations.form.allTemplatesHint') }}</span>
            </template>
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="t('adminDelegations.form.startDate')">
              <UInput v-model="startDateInput" type="datetime-local" :disabled="isSaving" class="w-full" />
            </UFormField>
            <UFormField :label="t('adminDelegations.form.endDate')">
              <UInput v-model="endDateInput" type="datetime-local" :disabled="isSaving" class="w-full" />
            </UFormField>
          </div>

          <UFormField :label="t('adminDelegations.form.note')">
            <UTextarea v-model="formState.note" :placeholder="t('adminDelegations.form.notePlaceholder')" :rows="2" :disabled="isSaving" class="w-full" />
          </UFormField>

          <UFormField :label="t('common.table.status')">
            <USwitch v-model="formState.active" :disabled="isSaving" :label="formState.active ? t('adminDelegations.active') : t('adminDelegations.inactive')" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" :label="t('common.actions.cancel')" @click="isModalOpen = false" />
          <UButton color="primary" :loading="isSaving" :label="t('common.actions.save')" @click="saveForm" />
        </div>
      </template>
    </UModal>
  </div>
</template>
