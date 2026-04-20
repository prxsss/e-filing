<script setup lang="ts">
definePageMeta({
  title: 'allTemplates',
  middleware: ['permission'],
  permission: 'template.view',
});

// --- 1. Type Definitions ---
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
  placedFieldsData: any;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// --- 2. State & Data ---
const localePath = useLocalePath();
const { t, locale } = useI18n();
const searchQuery = ref('');
const statusFilter = ref('all');
const sortField = ref<'name' | 'createdAt'>('name');
const sortDirection = ref<'asc' | 'desc'>('asc');
const isLoading = ref(true);
const error = ref<string | null>(null);

const authStore = useAuthStore();

const statusOptions = computed(() => [
  { value: 'all', label: t('adminTemplates.list.statusAll') },
  { value: 'active', label: t('adminTemplates.list.statusActive') },
  { value: 'inactive', label: t('adminTemplates.list.statusInactive') },
]);

const sortFieldOptions = computed(() => [
  { value: 'name', label: t('adminTemplates.list.sortByName') },
  { value: 'createdAt', label: t('adminTemplates.list.sortByCreatedAt') },
]);

const templates = ref<Template[]>([]);

watch(sortField, (newField, oldField) => {
  if (newField === oldField)
    return;

  sortDirection.value = newField === 'createdAt' ? 'desc' : 'asc';
});

// Fetch templates from API
async function fetchTemplates() {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await $fetch<ApiResponse<Template[]>>('/api/pdf-templates');

    if (result.success && result.data) {
      templates.value = result.data;
    }
  }
  catch (err) {
    console.error('Error fetching templates:', err);
    error.value = err instanceof Error ? err.message : t('adminTemplates.list.loadFailed');
  }
  finally {
    isLoading.value = false;
  }
}

// --- 3. Computed Logic ---
const filteredTemplates = computed(() => {
  const filtered = templates.value.filter((item) => {
    // 1. Filter Status
    if (statusFilter.value === 'active' && !item.isActive)
      return false;
    if (statusFilter.value === 'inactive' && item.isActive)
      return false;

    // 2. Filter Search Text
    const query = searchQuery.value.toLowerCase();
    return (item.name?.toLowerCase().includes(query) ?? false)
      || item.description?.toLowerCase().includes(query);
  });

  const localeCode = locale.value === 'th' ? 'th-TH' : 'en-US';

  const getTimestamp = (value: string | null | undefined) => {
    const parsed = value ? new Date(value).getTime() : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  return [...filtered].sort((a, b) => {
    let compareResult = 0;

    if (sortField.value === 'createdAt') {
      compareResult = getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
    }
    else {
      const nameA = (a.name ?? '').trim();
      const nameB = (b.name ?? '').trim();
      compareResult = nameA.localeCompare(nameB, localeCode, {
        sensitivity: 'base',
        numeric: true,
      });
    }

    return sortDirection.value === 'asc' ? compareResult : -compareResult;
  });
});

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale.value === 'th' ? 'th-TH' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function navigateToCreate() {
  navigateTo(localePath('/admin/templates/create'));
}

function navigateToDetails(id: number) {
  navigateTo(localePath(`/admin/templates/${id}`));
}

onMounted(() => {
  fetchTemplates();
});
</script>

<template>
  <div class="min-h-screen pb-12">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center h-96">
      <div class="text-center">
        <UIcon name="i-lucide-loader" class="text-4xl text-gray-400 mb-4 animate-spin" />
        <p class="text-gray-500">
          {{ t('adminTemplates.list.loading') }}
        </p>
      </div>
    </div>

    <!-- Error State -->
    <UContainer v-else-if="error" class="py-8">
      <UCard>
        <div class="text-center py-8">
          <UIcon name="i-lucide-triangle-alert" class="text-4xl text-red-400 mb-4" />
          <p class="text-red-600 mb-4">
            {{ error }}
          </p>
          <UButton @click="fetchTemplates">
            {{ t('adminTemplates.list.tryAgain') }}
          </UButton>
        </div>
      </UCard>
    </UContainer>

    <!-- Main Content -->
    <UContainer v-else class="space-y-6">
      <!-- 1. Header & Actions -->
      <div class="flex justify-between items-end">
        <div>
          <h1 class="text-2xl font-bold mb-4">
            {{ t('allTemplates') }}
          </h1>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="authStore.can('template.create')"
            icon="i-heroicons-plus"
            :label="t('createTemplate')"
            size="lg"
            class="shadow-sm"
            @click="navigateToCreate"
          />
        </div>
      </div>

      <!-- 2. Filters & Search Bar -->
      <div class="w-full">
        <div class="space-y-2">
          <div class="flex justify-end">
            <UFieldGroup class="w-full sm:w-auto">
              <UInput
                v-model="searchQuery"
                class="w-full sm:w-96"
                icon="i-heroicons-magnifying-glass"
                size="md"
                variant="outline"
                :placeholder="t('adminTemplates.list.searchPlaceholder')"
              />
              <UButton
                icon="i-heroicons-magnifying-glass"
                color="primary"
                variant="solid"
                size="md"
                :loading="isLoading"
                :aria-label="t('search')"
                @click="fetchTemplates"
              />
            </UFieldGroup>
          </div>

          <div class="flex flex-col sm:flex-row justify-end gap-2">
            <USelect
              v-model="statusFilter"
              :items="statusOptions"
              option-attribute="label"
              icon="i-heroicons-funnel"
              size="md"
              class="w-full sm:w-40"
            />
            <USelect
              v-model="sortField"
              :items="sortFieldOptions"
              option-attribute="label"
              icon="i-heroicons-adjustments-horizontal"
              size="md"
              class="w-full sm:w-44"
            />
            <UButton
              color="neutral"
              variant="outline"
              size="md"
              class="justify-center sm:w-10"
              :icon="sortDirection === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'"
              :aria-label="t('adminTemplates.list.sortDirectionAria', { direction: sortDirection === 'asc' ? t('adminTemplates.list.ascending') : t('adminTemplates.list.descending') })"
              @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
            />
          </div>
        </div>
      </div>

      <!-- 3. Template Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="template in filteredTemplates"
          :key="template.id"
          class="bg-white rounded-xl p-5 border shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-1 relative group overflow-hidden"
          :class="template.isActive ? 'border-gray-200 hover:border-primary-400' : 'border-red-100 bg-red-50/30'"
          @click="navigateToDetails(template.id)"
        >
          <!-- Status Strip (Left Border Indicator) -->
          <div
            class="absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-200"
            :class="template.isActive ? 'bg-emerald-500 group-hover:bg-emerald-400' : 'bg-red-400'"
          />

          <!-- Top Row: Icon & Status Badge -->
          <div class="flex justify-between items-start mb-4 pl-3">
            <div
              class="w-12 h-12 rounded-lg flex items-center justify-center text-2xl transition-transform duration-200 group-hover:scale-110"
              :class="template.isActive ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-500'"
            >
              <UIcon name="i-heroicons-document-text" class="w-6 h-6" />
            </div>

            <UBadge
              :color="template.isActive ? 'success' : 'error'"
              variant="subtle"
              size="xs"
              class="px-2 py-1"
            >
              <div class="flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full" :class="template.isActive ? 'bg-emerald-500' : 'bg-red-500'" />
                {{ template.isActive ? t('adminTemplates.list.active') : t('adminTemplates.list.inactive') }}
              </div>
            </UBadge>
          </div>

          <!-- Main Content -->
          <div class="pl-3 space-y-2 mb-4">
            <div class="flex justify-between items-baseline gap-2">
              <h3 class="font-bold text-gray-800 text-lg leading-tight group-hover:text-primary-700 transition-colors line-clamp-1">
                {{ template.name }}
              </h3>
            </div>

            <p class="text-sm line-clamp-2 h-10 leading-relaxed">
              {{ template.description || t('adminTemplates.list.noDescription') }}
            </p>
          </div>

          <!-- Footer: Meta -->
          <div class="pl-3 pt-4 border-t border-gray-100 flex justify-end items-center gap-1.5 text-xs">
            <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
            <span>{{ formatDate(template.createdAt) }}</span>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="filteredTemplates.length === 0" class="col-span-full py-16 text-center bg-white rounded-xl border-2 border-dashed border-gray-300">
          <div class="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <UIcon name="i-heroicons-document-magnifying-glass" class="w-8 h-8" />
          </div>
          <h3 class="text-gray-900 font-medium text-lg">
            {{ t('adminTemplates.list.emptyTitle') }}
          </h3>
          <p class="text-gray-500 text-sm mt-1">
            {{ t('adminTemplates.list.emptyDescription') }}
          </p>
          <UButton
            variant="link"
            color="neutral"
            :label="t('adminTemplates.list.clearAllFilters')"
            class="mt-2"
            @click="{ searchQuery = ''; statusFilter = 'all'; sortField = 'name'; sortDirection = 'asc'; }"
          />
        </div>
      </div>
    </UContainer>
  </div>
</template>
