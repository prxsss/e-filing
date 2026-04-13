<script setup lang="ts">
definePageMeta({
  title: 'newRequest',
  middleware: ['permission'],
  permission: 'request.create',
});

type Template = {
  id: number;
  name: string | null;
  description: string | null;
  isActive: boolean | null;
};

const router = useRouter();
const { t } = useI18n();
const searchQuery = ref('');

const { data: templatesData, status, error, refresh } = await useFetch<{ success: boolean; data: Template[] }>('/api/pdf-templates');

const activeTemplates = computed<Template[]>(() => {
  if (!templatesData.value?.data)
    return [];
  return templatesData.value.data.filter(t => t.isActive === true);
});

const filteredRequests = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query)
    return activeTemplates.value;
  return activeTemplates.value.filter(t =>
    (t.name ?? '').toLowerCase().includes(query)
    || (t.description ?? '').toLowerCase().includes(query),
  );
});

function handleSelectRequest(templateId: number) {
  router.push(`/student/new-request/${templateId}`);
}
</script>

<template>
  <div class="min-h-screen pb-12">
    <!-- Loading state -->
    <div v-if="status === 'pending'" class="flex items-center justify-center h-96">
      <div class="text-center">
        <UIcon name="i-lucide-loader" class="text-4xl text-gray-400 mb-4 animate-spin" />
        <p class="text-gray-500">
          {{ t('studentNewRequest.detail.loading') }}
        </p>
      </div>
    </div>

    <!-- Error state -->
    <UContainer v-else-if="error" class="py-8">
      <UCard>
        <div class="text-center py-8">
          <UIcon name="i-lucide-triangle-alert" class="text-4xl text-red-400 mb-4" />
          <p class="text-red-600 mb-4">
            {{ error.message }}
          </p>
          <UButton @click="refresh()">
            {{ t('studentNewRequest.list.tryAgain') }}
          </UButton>
        </div>
      </UCard>
    </UContainer>

    <!-- Main content -->
    <UContainer v-else class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">
            {{ t('studentNewRequest.list.title') }}
          </h1>
          <p class="text-sm text-slate-500 mt-1">
            {{ t('studentNewRequest.list.description') }}
          </p>
        </div>
      </div>

      <!-- Search bar -->
      <div class="p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4">
        <div class="relative w-full">
          <UInput
            v-model="searchQuery"
            icon="i-heroicons-magnifying-glass"
            :placeholder="t('studentNewRequest.list.searchPlaceholder')"
            class="w-full"
            size="md"
          />
        </div>
      </div>

      <!-- Template catalog grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="template in filteredRequests"
          :key="template.id"
          class="cursor-pointer group h-full"
          @click="handleSelectRequest(template.id)"
        >
          <div class="relative group overflow-hidden h-full rounded-xl bg-white border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-1 hover:border-primary-400">
            <!-- Left accent strip -->
            <div class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-emerald-500 group-hover:bg-emerald-400 transition-colors duration-200" />

            <UCard
              class="h-full border-0 shadow-none rounded-xl bg-transparent hover:shadow-none"
              :ui="{ root: 'h-full', body: 'pl-3', header: 'pl-3' }"
            >
              <template #header>
                <div class="flex justify-between items-start mb-4">
                  <div
                    class="w-12 h-12 rounded-lg flex items-center justify-center text-2xl transition-transform duration-200 group-hover:scale-110 bg-gray-100 text-gray-600"
                  >
                    <UIcon name="i-heroicons-document-text" class="w-6 h-6" />
                  </div>
                </div>
              </template>

              <div class="space-y-2 mb-4 pl-0">
                <h3 class="font-bold text-gray-800 text-lg leading-tight group-hover:text-primary-700 transition-colors line-clamp-1">
                  {{ template.name }}
                </h3>
                <p class="text-sm line-clamp-2 h-10 leading-relaxed text-gray-600">
                  {{ template.description || t('studentNewRequest.list.noDescription') }}
                </p>
              </div>

              <div class="pt-4 border-t border-gray-100 flex justify-end items-center gap-1.5 text-xs text-gray-500">
                <span>{{ t('studentNewRequest.list.selectToContinue') }}</span>
              </div>
            </UCard>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-if="filteredRequests.length === 0"
          class="col-span-full py-16 text-center bg-white rounded-xl border-2 border-dashed border-gray-300"
        >
          <div class="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <UIcon name="i-heroicons-document-magnifying-glass" class="w-8 h-8" />
          </div>
          <h3 class="text-gray-900 font-medium text-lg">
            {{ t('studentNewRequest.list.emptyTitle') }}
          </h3>
          <p class="text-gray-500 text-sm mt-1">
            {{ t('studentNewRequest.list.emptyDescription') }}
          </p>
          <UButton
            v-if="searchQuery"
            variant="link"
            color="neutral"
            :label="t('studentNewRequest.list.clearSearch')"
            class="mt-2"
            @click="searchQuery = ''"
          />
        </div>
      </div>
    </UContainer>
  </div>
</template>
