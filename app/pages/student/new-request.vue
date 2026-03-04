<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

definePageMeta({
  title: 'newRequest',
});

const toast = useToast();

// ===== STEP 1: Define data structure =====
// Simple request type interface - easy to extend with API later
type RequestType = {
  id: number;
  name: string;
  description: string;
  estimatedTime: string;
  icon: string;
};

// ===== STEP 2: Hardcoded request data =====
// This will be replaced with API call later
const requestTypes: RequestType[] = [
  {
    id: 11,
    name: 'General Request (KU.1)',
    description: 'For general administrative inquiries and petitions.',
    estimatedTime: '1-3 Days',
    icon: 'i-lucide-file-text',
  },
  {
    id: 2,
    name: 'Tuition Fee Waiver',
    description: 'Request for delay or waiver of tuition fees.',
    estimatedTime: '5-7 Days',
    icon: 'i-lucide-wallet',
  },
  {
    id: 3,
    name: 'Transcript Request',
    description: 'Official academic record request.',
    estimatedTime: '2 Days',
    icon: 'i-lucide-scroll',
  },
  {
    id: 4,
    name: 'Late Registration',
    description: 'Petition to register for courses after deadline.',
    estimatedTime: '3-5 Days',
    icon: 'i-lucide-calendar',
  },
  {
    id: 5,
    name: 'Equipment Borrowing',
    description: 'Request to borrow faculty laboratory equipment.',
    estimatedTime: '1 Day',
    icon: 'i-lucide-package',
  },
];

// ===== STEP 3: Setup Vue composables and state =====
const router = useRouter();
const searchQuery = ref('');
const isCreating = ref(false);

// ===== STEP 4: Search/filter logic =====
const filteredRequests = computed(() => {
  if (!searchQuery.value)
    return requestTypes;

  const query = searchQuery.value.toLowerCase();
  return requestTypes.filter((req) => {
    return (
      req.name.toLowerCase().includes(query)
      || req.description.toLowerCase().includes(query)
    );
  });
});

// ===== STEP 5: Navigation handler - Create request and redirect =====
async function handleSelectRequest(templateId: number) {
  if (isCreating.value)
    return;

  isCreating.value = true;

  try {
    // Create a new request
    const result: any = await $fetch('/api/requests', {
      method: 'POST',
      body: {
        templateId,
        status: 'draft',
      },
    });

    if (result.success && result.data) {
      // Navigate to the form filling page
      router.push(`/student/my-requests/${result.data.id}`);
    }
    else {
      console.error('Failed to create request:', result.error);
      toast.add({
        title: 'Failed to create request',
        description: 'Please try again.',
        color: 'error',
      });
    }
  }
  catch (error) {
    console.error('Error creating request:', error);
    toast.add({
      title: 'Error',
      description: 'An error occurred. Please try again.',
      color: 'error',
    });
  }
  finally {
    isCreating.value = false;
  }
}

// ===== STEP 6: Go back handler =====
// function goBack() {
//   router.back();
// }
</script>

<template>
  <!-- ===== STEP 1: Page Container with max-width and padding ===== -->
  <div class="space-y-6">
    <!-- ===== STEP 2: Header with back button and title ===== -->
    <div class="flex items-center gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">
          New Request
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          Choose a request type to get started
        </p>
      </div>
    </div>

    <!-- ===== STEP 3: Search bar ===== -->
    <div class="flex gap-3">
      <div class="flex-1">
        <UInput
          v-model="searchQuery"
          placeholder="Search requests by name"
          icon="i-lucide-search"
          color="success"
        />
      </div>
    </div>

    <!-- ===== STEP 4: Result counter ===== -->
    <div class="text-sm text-slate-500">
      Showing {{ filteredRequests.length }} of {{ requestTypes.length }} requests
    </div>

    <!-- ===== STEP 5: Request catalog grid ===== -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="request in filteredRequests"
        :key="request.id"
        class="cursor-pointer group"
        :class="{ 'opacity-50 pointer-events-none': isCreating }"
        @click="handleSelectRequest(request.id)"
      >
        <!-- Request card using UCard component -->
        <UCard
          class="h-full hover:shadow-md transition-all duration-200 hover:border-green-500"
          @click.prevent
        >
          <!-- ===== STEP 6: Card header with icon and category badge ===== -->
          <template #header>
            <div class="flex items-start justify-between">
              <!-- Icon badge -->
              <div
                class="bg-green-50 text-green-700 p-3 rounded-lg group-hover:bg-green-600 group-hover:text-white transition-colors duration-200"
              >
                <UIcon :name="request.icon" class="w-6 h-6" />
              </div>
            </div>
          </template>

          <!-- ===== STEP 7: Card content - title and description ===== -->
          <div class="space-y-3">
            <h3
              class="font-bold text-slate-800 group-hover:text-green-700 transition-colors duration-200"
            >
              {{ request.name }}
            </h3>
            <p class="text-sm text-slate-600 line-clamp-2">
              {{ request.description }}
            </p>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Loading overlay -->
    <div
      v-if="isCreating"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
        <i class="fas fa-spinner fa-spin text-4xl text-green-600" />
        <p class="text-gray-700 font-medium">
          Creating request...
        </p>
      </div>
    </div>

    <!-- ===== STEP 9: Empty state when no results ===== -->
    <div
      v-if="filteredRequests.length === 0"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-inbox"
        class="w-12 h-12 text-slate-300 mx-auto mb-4"
      />
      <h3 class="font-semibold text-slate-800 mb-2">
        No requests found
      </h3>
      <p class="text-sm text-slate-500">
        Try adjusting your search query
      </p>
    </div>
  </div>
</template>
