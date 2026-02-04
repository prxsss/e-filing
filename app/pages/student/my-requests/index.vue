<script lang="ts" setup>
definePageMeta({
  title: 'myRequests',
});

// === Composables ===
const { t } = useI18n();
const router = useRouter();
const localePath = useLocalePath();

// === Type Definitions ===
type RequestStatus = 'Approved' | 'In Progress' | 'Rejected' | 'Draft';

type Request = {
  id: string;
  title: string;
  date: string;
  status: RequestStatus;
  signer: string;
};

// === Table Configuration ===
const columns: any[] = [
  { accessorKey: 'id', header: 'Request ID' },
  { accessorKey: 'title', header: 'Topic' },
  { accessorKey: 'date', header: 'Date' },
  { accessorKey: 'signer', header: 'Approver' },
  { accessorKey: 'status', header: 'Status' },
];

// === Filter Options ===
const statusOptions = [
  { label: 'All Statuses', value: undefined },
  { label: 'Draft', value: 'Draft' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
];

// === Reactive State ===
const searchQuery = ref('');
const selectedStatus = ref<RequestStatus | undefined>(undefined);
const page = ref(1);
const pageCount = ref(10); // จำนวนรายการต่อหน้า

// === Mock Data ===
const allRequests: Request[] = [
  { id: 'REQ-2024-001', title: 'Late Registration (Course 01204)', date: '2024-01-10', status: 'Approved', signer: 'Dean of Engineering' },
  { id: 'REQ-2024-002', title: 'Tuition Fee Installment', date: '2024-01-12', status: 'In Progress', signer: 'Dr. Suthep Panya' },
  { id: 'REQ-2024-003', title: 'Activity Room Booking', date: '2024-01-15', status: 'Rejected', signer: 'Building Manager' },
  { id: 'REQ-2024-004', title: 'Add/Drop Course Request', date: '2024-01-18', status: 'Draft', signer: '-' },
  { id: 'REQ-2024-005', title: 'Scholarship Application', date: '2024-01-20', status: 'In Progress', signer: 'Financial Aid Office' },
  { id: 'REQ-2024-006', title: 'Transcript Request', date: '2024-01-22', status: 'Approved', signer: 'Registrar' },
  { id: 'REQ-2024-007', title: 'Dormitory Change Request', date: '2024-01-25', status: 'In Progress', signer: 'Housing Manager' },
  { id: 'REQ-2024-008', title: 'Medical Certificate Submission', date: '2024-01-28', status: 'Approved', signer: 'Health Center' },
  { id: 'REQ-2024-009', title: 'Course Prerequisite Waiver', date: '2024-02-01', status: 'In Progress', signer: 'Department Head' },
  { id: 'REQ-2024-010', title: 'Payment Plan Setup', date: '2024-02-03', status: 'Draft', signer: '-' },
  { id: 'REQ-2024-011', title: 'Student ID Card Replacement', date: '2024-02-05', status: 'Approved', signer: 'Student Affairs' },
  { id: 'REQ-2024-012', title: 'Grade Appeal Submission', date: '2024-02-08', status: 'In Progress', signer: 'Academic Dean' },
  { id: 'REQ-2024-013', title: 'Semester Extension Request', date: '2024-02-10', status: 'Rejected', signer: 'Academic Advisor' },
  { id: 'REQ-2024-014', title: 'Financial Aid Appeal', date: '2024-02-12', status: 'Draft', signer: '-' },
  { id: 'REQ-2024-015', title: 'Campus Parking Permit', date: '2024-02-15', status: 'Approved', signer: 'Parking Services' },
];

// === Computed Logic ===
// 1. Filter Data
const filteredRows = computed(() => {
  return allRequests.filter((request) => {
    // Filter by Status
    const statusMatch = !selectedStatus.value || request.status === selectedStatus.value;

    // Filter by Search
    const query = searchQuery.value.toLowerCase();
    const searchMatch = !query
      || request.title.toLowerCase().includes(query)
      || request.id.toLowerCase().includes(query);

    return statusMatch && searchMatch;
  });
});

// 2. Pagination Logic
const paginatedRows = computed(() => {
  const start = (page.value - 1) * pageCount.value;
  const end = page.value * pageCount.value;
  return filteredRows.value.slice(start, end);
});

// === Methods ===
function handleNewRequest() {
  router.push(localePath('/student/new-request'));
}

// Helper: เลือกสี Badge ตามสถานะ (for future use)
function _getStatusColor(status: RequestStatus): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'Approved': return 'success';
    case 'In Progress': return 'info';
    case 'Rejected': return 'error';
    case 'Draft': return 'neutral';
    default: return 'neutral';
  }
}
</script>

<template>
  <div class="space-y-6 min-h-screen pb-10">
    <!-- 1. Page Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold  flex items-center gap-2">
          <UIcon name="i-heroicons-folder-open" class="text-primary-500" />
          {{ t('myRequests') || 'รายการคำร้องของฉัน' }}
        </h2>
        <p class="text-sm  mt-1">
          ติดตามสถานะและประวัติการยื่นคำร้องทั้งหมด
        </p>
      </div>
      <UButton
        icon="i-heroicons-plus"
        color="primary"
        size="md"
        class="shadow-sm"
        @click="handleNewRequest"
      >
        {{ t('newRequest') || 'สร้างคำร้องใหม่' }}
      </UButton>
    </div>

    <!-- 2. Main Table Card -->
    <UCard>
      <div class="flex flex-col sm:flex-row justify-between gap-3 mb-6">
        <!-- Left: Search -->
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="ค้นหาตามรหัส หรือชื่อเรื่อง..."
          class="w-full sm:w-72"
        />

        <!-- Right: Filter -->
        <USelect
          v-model="selectedStatus"
          :items="statusOptions"
          option-attribute="label"
          placeholder="สถานะ"
          class="w-full sm:w-48"
        />
      </div>

      <!-- Table Content -->
      <UTable
        :data="paginatedRows"
        :columns="columns"
        :loading="false"
        empty=" "
      />

      <!-- Empty State -->
      <div v-if="filteredRows.length === 0" class="py-12 text-center">
        <div class="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
          <UIcon name="i-heroicons-inbox" class="w-8 h-8 " />
        </div>
        <h3 class="font-medium mb-1">
          ไม่พบข้อมูลคำร้อง
        </h3>
      </div>

      <!-- Pagination Footer -->
      <template v-if="filteredRows.length > 0" #footer>
        <div class="justify-items-center py-2">
          <UPagination
            v-model:page="page"
            :items-per-page="10"
            :total="filteredRows.length"
            size="md"
          />
        </div>
      </template>
    </UCard>
  </div>
</template>
