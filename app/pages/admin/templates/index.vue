<script setup lang="ts">
definePageMeta({
  title: 'allTemplates',
});

// --- 1. Type Definitions ---
type Template = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  version: string | null;
  isActive: boolean | null;
  createdBy: number | null;
  createdAt: string;
  documentUrl: string | null;
  documentWidth: number | null;
  documentHeight: number | null;
  placedFieldsData: any;
};

// --- 2. State & Data ---
const searchQuery = ref('');
const statusFilter = ref('all');
const isLoading = ref(true);
const error = ref(null);

const statusOptions = [
  { value: 'all', label: 'สถานะ: ทั้งหมด (All)' },
  { value: 'active', label: 'เปิดใช้งาน (Active)' },
  { value: 'inactive', label: 'ปิดใช้งาน (Inactive)' },
];

const templates = ref<Template[]>([]);

// Fetch templates from API
async function fetchTemplates() {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await $fetch('/api/templates');

    if (result.success && result.data) {
      templates.value = result.data;
    }
  }
  catch (err) {
    console.error('Error fetching templates:', err);
    error.value = err.message || 'Failed to load templates';
  }
  finally {
    isLoading.value = false;
  }
}

// --- 3. Computed Logic ---
const filteredTemplates = computed(() => {
  return templates.value.filter((item) => {
    // 1. Filter Status
    if (statusFilter.value === 'active' && !item.isActive)
      return false;
    if (statusFilter.value === 'inactive' && item.isActive)
      return false;

    // 2. Filter Search Text
    const query = searchQuery.value.toLowerCase();
    return item.name.toLowerCase().includes(query)
      || item.description?.toLowerCase().includes(query);
  });
});

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function navigateToCreate() {
  navigateTo('/admin/templates/create');
}

function navigateToDetails(id: number) {
  navigateTo(`/admin/templates/${id}`);
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
        <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4" />
        <p class="text-gray-500">
          กำลังโหลด Templates...
        </p>
      </div>
    </div>

    <!-- Error State -->
    <UContainer v-else-if="error" class="py-8">
      <UCard>
        <div class="text-center py-8">
          <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4" />
          <p class="text-red-600 mb-4">
            {{ error }}
          </p>
          <UButton @click="fetchTemplates">
            ลองอีกครั้ง
          </UButton>
        </div>
      </UCard>
    </UContainer>

    <!-- Main Content -->
    <UContainer v-else class="space-y-6">
      <!-- 1. Header & Actions -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">
            ต้นแบบเอกสาร (Templates)
          </h1>
        </div>
        <UButton
          icon="i-heroicons-plus"
          color="info"
          label="สร้างต้นแบบใหม่"
          size="lg"
          class="shadow-sm"
          @click="navigateToCreate"
        />
      </div>

      <!-- 2. Filters & Search Bar -->
      <div class="p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4">
        <!-- Search -->
        <div class="relative w-full">
          <UInput
            v-model="searchQuery"
            icon="i-heroicons-magnifying-glass"
            placeholder="ค้นหาชื่อเอกสาร, รหัส, หรือรายละเอียด..."
            class="w-full"
            size="md"
          />
        </div>

        <!-- Filter Status -->
        <div class="w-full md:w-64">
          <USelect
            v-model="statusFilter"
            :items="statusOptions"
            option-attribute="label"
            icon="i-heroicons-funnel"
            size="md"
          />
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
                {{ template.isActive ? 'Active' : 'Inactive' }}
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
              {{ template.description || 'ไม่มีคำอธิบาย' }}
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
            ไม่พบเอกสารที่ค้นหา
          </h3>
          <p class="text-gray-500 text-sm mt-1">
            ลองปรับเปลี่ยนคำค้นหา หรือตัวกรองสถานะใหม่
          </p>
          <UButton
            variant="link"
            color="neutral"
            label="ล้างตัวกรองทั้งหมด"
            class="mt-2"
            @click="{ searchQuery = ''; statusFilter = 'all' }"
          />
        </div>
      </div>
    </UContainer>
  </div>
</template>
