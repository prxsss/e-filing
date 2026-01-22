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

// Mock Data
const requestData = ref<RequestData>({
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
const pdfUrl = ref('/General-Request.pdf');
const pdfFile = ref<File | null>(null);
const placedFields = ref([]);
const selectedField = ref(null);
const _useSavedSignature = ref(false);

// --- Methods ---
async function loadPdfFile() {
  try {
    const response = await fetch(pdfUrl.value);
    const blob = await response.blob();
    pdfFile.value = new File([blob], 'Request-for-Registration.pdf', { type: 'application/pdf' });
  }
  catch (error) {
    console.error('Error loading PDF:', error);
  }
}

// function handleReject() {
//   console.warn('Reject request');
// }

// function handleApprove() {
//   console.warn('Sign and Approve');
// }

function downloadPdf() {
  window.open(pdfUrl.value, '_blank');
}

function zoomIn() {
  console.warn('Zoom in');
}

function zoomOut() {
  console.warn('Zoom out');
}

onMounted(() => {
  loadPdfFile();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header with Breadcrumb -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <UBreadcrumb
          :links="[
            { label: 'Documents', to: '/admin/templates' },
            { label: 'Grade Correction Request', to: `/admin/templates/${templateId}` },
          ]"
        />
        <div class="mt-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              Document Preview
            </h1>
            <p class="mt-1 text-sm text-gray-500">
              Request ID: {{ requestData.id }} • Submitted on {{ requestData.submittedAt }}
            </p>
          </div>
          <div class="flex gap-2">
            <UButton
              icon="i-heroicons-magnifying-glass-plus"
              variant="ghost"
              color="neutral"
              @click="zoomIn"
            />
            <UButton
              icon="i-heroicons-magnifying-glass-minus"
              variant="ghost"
              color="neutral"
              @click="zoomOut"
            />
            <UButton
              icon="i-heroicons-arrow-down-tray"
              variant="ghost"
              color="neutral"
              @click="downloadPdf"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: PDF Preview -->
        <div class="lg:col-span-2">
          <template-pdf-create
            v-if="pdfFile"
            :pdf-file="pdfFile"
            :placed-fields="placedFields"
            :selected-field="selectedField || undefined"
            new-template-name=""
            :selected-contract-id="undefined"
          />
          <UCard v-else>
            <div class="flex items-center justify-center h-96">
              <div class="text-center">
                <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4" />
                <p class="text-gray-500">
                  กำลังโหลดเอกสาร...
                </p>
              </div>
            </div>
          </UCard>
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
