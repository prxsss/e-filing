<script setup lang="ts">
import AdminDashboard from '~/components/dashboard/admin-dashboard.vue';
import SignerDashboard from '~/components/dashboard/signer-dashboard.vue';
import StudentDashboard from '~/components/dashboard/student-dashboard.vue';

definePageMeta({
  title: 'dashboard',
});

const authStore = useAuthStore();

const DASHBOARD_PERMISSION_MAP = [
  { permission: 'dashboard.admin.view', component: AdminDashboard },
  { permission: 'dashboard.signer.view', component: SignerDashboard },
  { permission: 'dashboard.student.view', component: StudentDashboard },
];

const activeDashboard = computed(() =>
  DASHBOARD_PERMISSION_MAP.find(({ permission }) => authStore.can(permission))?.component ?? null,
);
</script>

<template>
  <component :is="activeDashboard" v-if="activeDashboard" />
  <div v-else class="p-4">
    <h1 class="text-2xl font-bold mb-4">
      No Dashboard Access
    </h1>
  </div>
</template>
