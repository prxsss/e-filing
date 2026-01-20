<script lang="ts" setup>
definePageMeta({
  title: 'myRequests',
});

// === Composables ===
const { t } = useI18n();
const router = useRouter();
const localePath = useLocalePath();

// === Reactive State (Filters & Search) ===
const selectedStatus = ref<string | null>(null);
const searchQuery = ref('');

// === Request Type Definition ===
type Request = {
  id: string;
  title: string;
  date: string;
  status: 'Approved' | 'In Progress' | 'Rejected' | 'Draft';
  signer: string;
  progress: number;
};

// === Mock Data: All Requests ===
const allRequests: Request[] = [
  { id: 'REQ-2024-001', title: 'Late Registration (Course 01204)', date: '2024-01-10', status: 'Approved', signer: 'Dean of Engineering', progress: 100 },
  { id: 'REQ-2024-002', title: 'Tuition Fee Installment', date: '2024-01-12', status: 'In Progress', signer: 'Dr. Suthep Panya', progress: 60 },
  { id: 'REQ-2024-003', title: 'Activity Room Booking', date: '2024-01-15', status: 'Rejected', signer: 'Building Manager', progress: 100 },
  { id: 'REQ-2024-004', title: 'Add/Drop Course Request', date: '2024-01-18', status: 'Draft', signer: '-', progress: 0 },
  { id: 'REQ-2024-005', title: 'Scholarship Application', date: '2024-01-20', status: 'In Progress', signer: 'Financial Aid Office', progress: 45 },
  { id: 'REQ-2024-006', title: 'Transcript Request', date: '2024-01-22', status: 'Approved', signer: 'Registrar', progress: 100 },
  { id: 'REQ-2024-007', title: 'Dormitory Change Request', date: '2024-01-25', status: 'In Progress', signer: 'Housing Manager', progress: 75 },
  { id: 'REQ-2024-008', title: 'Medical Certificate Submission', date: '2024-01-28', status: 'Approved', signer: 'Health Center', progress: 100 },
  { id: 'REQ-2024-009', title: 'Course Prerequisite Waiver', date: '2024-02-01', status: 'In Progress', signer: 'Department Head', progress: 30 },
  { id: 'REQ-2024-010', title: 'Payment Plan Setup', date: '2024-02-03', status: 'Draft', signer: '-', progress: 0 },
  { id: 'REQ-2024-011', title: 'Student ID Card Replacement', date: '2024-02-05', status: 'Approved', signer: 'Student Affairs', progress: 100 },
  { id: 'REQ-2024-012', title: 'Grade Appeal Submission', date: '2024-02-08', status: 'In Progress', signer: 'Academic Dean', progress: 50 },
  { id: 'REQ-2024-013', title: 'Semester Extension Request', date: '2024-02-10', status: 'Rejected', signer: 'Academic Advisor', progress: 100 },
  { id: 'REQ-2024-014', title: 'Financial Aid Appeal', date: '2024-02-12', status: 'Draft', signer: '-', progress: 0 },
  { id: 'REQ-2024-015', title: 'Campus Parking Permit', date: '2024-02-15', status: 'Approved', signer: 'Parking Services', progress: 100 },
];

// === Filter Options ===
const statusOptions = [
  { label: 'All Statuses', value: null },
  { label: 'Draft', value: 'Draft' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
];

// === Filtered Requests (Computed) ===
const filteredRequests = computed(() => {
  return allRequests.filter((request) => {
    // Filter by status
    if (selectedStatus.value && request.status !== selectedStatus.value) {
      return false;
    }

    // Filter by search query (title or ID)
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      const matchesTitle = request.title.toLowerCase().includes(query);
      const matchesId = request.id.toLowerCase().includes(query);
      if (!matchesTitle && !matchesId) {
        return false;
      }
    }

    return true;
  });
});

// function handleViewRequest(requestId: string) {
//   router.push(localePath(`/student/my-requests/${requestId}`));
// }

function handleNewRequest() {
  router.push(localePath('/student/new-request'));
}

function clearFilters() {
  selectedStatus.value = null;
  searchQuery.value = '';
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header with New Request Button -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-slate-800">
        {{ t('myRequests') }}
      </h2>
      <UButton
        icon="i-lucide-plus"
        color="primary"
        @click="handleNewRequest"
      >
        {{ t('newRequest') }}
      </UButton>
    </div>

    <!-- Filter Controls Section -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <!-- Search Bar Row -->
      <div class="flex flex-col md:flex-row gap-3 items-start md:items-end">
        <!-- Search Input -->
        <div class="w-full min-w-0">
          <label class="block text-sm font-medium text-slate-700 mb-2">
            {{ t('search') }}
          </label>
          <UInput
            v-model="searchQuery"
            type="text"
            :placeholder="t('searchByTitle') || 'Search by title...'"
            icon="i-lucide-search"
            class="w-full"
          />
        </div>

        <!-- Status Filter Dropdown -->
        <div class="w-full md:w-48">
          <label class="block text-sm font-medium text-slate-700 mb-2">
            {{ t('status') }}
          </label>
          <USelect
            v-model="selectedStatus"
            :items="statusOptions"
            class="w-full"
          />
        </div>
      </div>

      <!-- Clear Filters Button Row -->
      <div class="flex gap-2 pt-2">
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="!selectedStatus && !searchQuery"
          @click="clearFilters"
        >
          {{ t('clearFilters') || 'Clear Filters' }}
        </UButton>
        <span v-if="selectedStatus || searchQuery" class="text-xs text-slate-500 flex items-center">
          {{ filteredRequests.length }} {{ t('result') }}
        </span>
      </div>
    </div>

    <!-- Requests Table -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <UTable :data="filteredRequests" class="w-full" />

      <!-- Empty State -->
      <div v-if="filteredRequests.length === 0" class="p-8 text-center text-slate-500">
        <UIcon name="i-lucide-inbox" class="size-8 mx-auto mb-2 text-slate-400" />
        <p class="font-medium">
          {{ t('noRequests') || 'No requests found' }}
        </p>
        <p class="text-xs mt-1">
          {{ t('tryAdjustingFilters') || 'Try adjusting your filters or search' }}
        </p>
      </div>
    </div>
  </div>
</template>

<style>

</style>
