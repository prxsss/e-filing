<script setup lang="ts">
definePageMeta({
  title: 'newRequest',
});

type Template = {
  id: number;
  name: string | null;
  description: string | null;
  category: string | null;
  isActive: boolean | null;
};

const router = useRouter();
const searchQuery = ref('');

const { data: templatesData, status, error } = await useFetch<{ success: boolean; data: Template[] }>('/api/templates');

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
    || (t.description ?? '').toLowerCase().includes(query)
    || (t.category ?? '').toLowerCase().includes(query),
  );
});

function handleSelectRequest(templateId: number) {
  router.push(`/student/new-requests/${templateId}`);
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-slate-800">
        New Request
      </h1>
      <p class="text-sm text-slate-500 mt-1">
        Choose a request type to get started
      </p>
    </div>

    <!-- Search bar -->
    <div class="flex gap-3">
      <div class="flex-1">
        <UInput
          v-model="searchQuery"
          placeholder="Search requests by name or category"
          icon="i-lucide-search"
          color="success"
        />
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="w-8 h-8 text-green-600 animate-spin" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12">
      <UIcon name="i-lucide-triangle-alert" class="w-12 h-12 text-red-400 mx-auto mb-4" />
      <h3 class="font-semibold text-slate-800 mb-2">
        Failed to load templates
      </h3>
      <p class="text-sm text-slate-500">
        {{ error.message }}
      </p>
    </div>

    <template v-else>
      <!-- Result counter -->
      <div class="text-sm text-slate-500">
        Showing {{ filteredRequests.length }} of {{ activeTemplates.length }} templates
      </div>

      <!-- Template catalog grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="template in filteredRequests"
          :key="template.id"
          class="cursor-pointer group"
          @click="handleSelectRequest(template.id)"
        >
          <UCard class="h-full hover:shadow-md transition-all duration-200 hover:border-green-500">
            <template #header>
              <div class="flex items-start justify-between">
                <div class="bg-green-50 text-green-700 p-3 rounded-lg group-hover:bg-green-600 group-hover:text-white transition-colors duration-200">
                  <UIcon name="i-lucide-file-text" class="w-6 h-6" />
                </div>
                <UBadge
                  v-if="template.category"
                  :label="template.category"
                  color="neutral"
                  variant="soft"
                  size="sm"
                />
              </div>
            </template>

            <div class="space-y-2">
              <h3 class="font-bold text-slate-800 group-hover:text-green-700 transition-colors duration-200">
                {{ template.name }}
              </h3>
              <p class="text-sm text-slate-600 line-clamp-2">
                {{ template.description || 'No description available.' }}
              </p>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="filteredRequests.length === 0" class="text-center py-12">
        <UIcon name="i-lucide-inbox" class="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 class="font-semibold text-slate-800 mb-2">
          No templates found
        </h3>
        <p class="text-sm text-slate-500">
          {{ searchQuery ? 'Try adjusting your search query' : 'No active templates available' }}
        </p>
      </div>
    </template>
  </div>
</template>
