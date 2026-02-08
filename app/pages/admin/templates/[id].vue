<script lang="ts" setup>
definePageMeta({
  title: 'documentReview',
});

// --- Types ---
type WorkflowStep = {
  id: number;
  title: string;
  status: 'completed' | 'in-progress' | 'pending';
  icon: string;
};

type RequestData = {
  id: string;
  submittedAt: string;
  studentName: string;
  studentId: string;
  faculty: string;
  course: string;
  changeFrom: string;
  changeTo: string;
  reason: string;
};

// --- State ---
const route = useRoute();
const templateId = route.params.id;
const template = ref(null);
const isLoading = ref(true);
const error = ref(null);

// Mock Data
const _requestData = ref<RequestData>({
  id: 'KU-2023-0892',
  submittedAt: 'Oct 24, 2023',
  studentName: 'Somchai Saetang',
  studentId: '6310405821',
  faculty: 'Faculty of Engineering',
  course: '01204111 Computer Programming',
  changeFrom: 'Grade B',
  changeTo: 'Grade A',
  reason: 'The final examination score for 01204111 (Computer Programming) was incorrectly recorded. After reviewing the physical script with the instructor, it was found that Question 4 was not included in the final tally. I would like to request a correction from B to A.',
});

const workflowSteps = ref<WorkflowStep[]>([
  {
    id: 1,
    title: 'Nisit',
    status: 'pending',
    icon: 'i-heroicons-user-circle',
  },
  {
    id: 2,
    title: 'Teacher Name...',
    status: 'pending',
    icon: 'i-heroicons-user-circle',
  },
  {
    id: 3,
    title: 'Teacher Name...',
    status: 'pending',
    icon: 'i-heroicons-user-circle',
  },
]);

// const staffComment = ref('');
const pdfFile = ref<File | null>(null);
const placedFields = ref([]);
const _selectedField = ref(null);
const _useSavedSignature = ref(false);
const scale = ref(1); // Zoom level

// --- Methods ---
// Convert URL to File object
async function urlToFile(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  }
  catch (err) {
    console.error('Error converting URL to File:', err);
    throw err;
  }
}

// Fetch template data from API
async function fetchTemplate() {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await $fetch(`/api/templates/${templateId}`);

    if (result.success && result.data) {
      template.value = result.data;

      // Load PDF file from URL
      if (template.value.documentUrl) {
        const filename = template.value.documentUrl.split('/').pop();
        pdfFile.value = await urlToFile(template.value.documentUrl, filename);
      }

      // Set placed fields
      if (template.value.placedFieldsData) {
        placedFields.value = template.value.placedFieldsData;
      }
    }
    else {
      error.value = 'Template not found';
    }
  }
  catch (err) {
    console.error('Error fetching template:', err);
    error.value = err.message || 'Failed to load template';
  }
  finally {
    isLoading.value = false;
  }
}

// function handleReject() {
//   console.warn('Reject request');
// }

// function handleApprove() {
//   console.warn('Sign and Approve');
// }

function downloadPdf() {
  if (template.value?.documentUrl) {
    window.open(template.value.documentUrl, '_blank');
  }
}

onMounted(() => {
  fetchTemplate();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header with Breadcrumb -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <UBreadcrumb
          :links="[
            { label: 'Templates', to: '/admin/templates' },
            { label: template?.name || 'Loading...', to: `/admin/templates/${templateId}` },
          ]"
        />
        <div class="mt-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ template?.name || 'Document Preview' }}
            </h1>
            <p class="mt-1 text-sm text-gray-500">
              {{ template?.description || 'Loading...' }}
            </p>
          </div>
          <div class="flex gap-2">
            <UButton
              icon="i-heroicons-arrow-down-tray"
              variant="ghost"
              color="neutral"
              @click="downloadPdf"
            />
            <UButton
              to="`/admin/templates/edit?id=${templateId}`"
              icon="i-heroicons-pencil-square"
              variant="solid"
              color="info"
            >
              Edit
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
            กำลังโหลด Template...
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
          <UButton @click="$router.push('/admin/templates')">
            กลับไปหน้ารายการ Templates
          </UButton>
        </div>
      </UCard>

      <!-- Template Content -->
      <div v-else-if="template && pdfFile" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: PDF Preview -->
        <div class="lg:col-span-2">
          <!-- Zoom Controls -->
          <div class="mb-4 flex items-center gap-4 bg-white rounded-lg border border-gray-200 px-4 py-2">
            <span class="text-sm text-gray-600">Zoom:</span>
            <UButton
              icon="i-heroicons-minus"
              size="xs"
              variant="ghost"
              :disabled="scale <= 0.5"
              @click="scale = Math.max(0.5, scale - 0.25)"
            />
            <span class="text-sm font-medium w-12 text-center">{{ Math.round(scale * 100) }}%</span>
            <UButton
              icon="i-heroicons-plus"
              size="xs"
              variant="ghost"
              :disabled="scale >= 3"
              @click="scale = Math.min(3, scale + 0.25)"
            />
            <UButton
              size="xs"
              variant="ghost"
              @click="scale = 1"
            >
              Reset
            </UButton>
          </div>

          <!-- PDF Viewer -->
          <div class="bg-gray-100/50 overflow-auto p-8 rounded-lg border border-gray-200" style="min-height: 600px;">
            <template-pdf-create
              :pdf-file="pdfFile"
              :placed-fields="placedFields"
              :selected-field="null"
              :ui-scale="scale"
              :read-only="true"
            />
          </div>
        </div>

        <!-- Right: Sidebar -->
        <div class="space-y-6">
          <!-- Student Information -->
          <!-- <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Student Information
              </h3>
            </template>
            <div class="flex items-center gap-4 mb-4">
              <UAvatar
                size="xl"
                :alt="requestData.studentName"
                src="https://i.pravatar.cc/150?img=12"
              />
              <div>
                <h4 class="font-semibold text-gray-900">
                  {{ requestData.studentName }}
                </h4>
                <p class="text-sm text-gray-500">
                  ID: {{ requestData.studentId }}
                </p>
                <p class="text-sm text-gray-500">
                  {{ requestData.faculty }}
                </p>
              </div>
            </div>
          </UCard> -->

          <!-- Request Summary -->
          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Request Detail
              </h3>
            </template>
            <div class="space-y-3">
              <div class="flex items-start gap-2">
                <UIcon name="i-heroicons-arrow-right-circle-solid" class="text-green-500 mt-0.5 shrink-0" />
                <div class="text-sm">
                  <p class="text-gray-700">
                    ใบคำร้องทั่วไป / General Request
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-2">
                <UIcon name="i-heroicons-arrow-right-circle-solid" class="text-green-500 mt-0.5 shrink-0" />
                <div class="text-sm">
                  <p class="text-gray-700">
                    Detail 1 .......
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-2">
                <UIcon name="i-heroicons-arrow-right-circle-solid" class="text-green-500 mt-0.5 shrink-0" />
                <div class="text-sm">
                  <p class="text-gray-700">
                    Detail 2 .......
                  </p>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Workflow Progress -->
          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Order of signing
              </h3>
            </template>
            <div class="space-y-0">
              <template
                v-for="(step, index) in workflowSteps"
                :key="step.id"
              >
                <div class="flex items-center gap-3 py-2">
                  <div
                    class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    :class="{
                      'bg-green-100': step.status === 'in-progress',
                      'bg-gray-100': step.status === 'pending',
                    }"
                  >
                    <UIcon
                      :name="step.icon"
                      :class="{
                        'text-green-600': step.status === 'in-progress',
                        'text-gray-400': step.status === 'pending',
                      }"
                      class="text-xl"
                    />
                  </div>
                  <div class="flex-1">
                    <p
                      class="text-sm font-medium"
                      :class="{
                        'text-gray-900': step.status === 'in-progress',
                        'text-gray-500': step.status === 'pending',
                      }"
                    >
                      {{ step.title }}
                    </p>
                    <UBadge
                      v-if="step.status === 'in-progress'"
                      color="success"
                      variant="subtle"
                      size="xs"
                      class="mt-1"
                    >
                      In Progress
                    </UBadge>
                  </div>
                </div>

                <!-- Arrow between items -->
                <div
                  v-if="index < workflowSteps.length - 1"
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

          <!-- Fields List -->
          <UCard v-if="placedFields.length > 0">
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Fields ({{ placedFields.length }})
              </h3>
            </template>
            <div class="space-y-2">
              <div
                v-for="(field, index) in placedFields"
                :key="field.instanceId"
                class="p-2 bg-gray-50 rounded text-xs border border-gray-200"
              >
                <div class="font-medium text-gray-900">
                  {{ index + 1 }}. {{ field.label || field.name }}
                </div>
                <div class="text-gray-500 mt-1">
                  Type: {{ field.type }}
                </div>
              </div>
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
/* Additional custom styles if needed */
</style>
