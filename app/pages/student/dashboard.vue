<script setup lang="ts">
definePageMeta({
  title: 'dashboard',
});

const { t } = useI18n();

type Request = {
  id: string;
  title: string;
  submittedDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  description: string;
};

// Mock Data: รายการคำร้องล่าสุด
const recentRequests: Request[] = [
  {
    id: 'REQ-24001',
    title: 'คำร้องขอลงทะเบียนเรียนล่าช้า',
    submittedDate: '19 ม.ค. 2567',
    status: 'pending',
    description: 'รออาจารย์ที่ปรึกษา',
  },
  {
    id: 'REQ-23098',
    title: 'ขอใบรับรองความประพฤติ',
    submittedDate: '15 ม.ค. 2567',
    status: 'approved',
    description: 'อนุมัติแล้ว',
  },
  {
    id: 'REQ-23095',
    title: 'ขอผ่อนผันค่าเทอม',
    submittedDate: '10 ธ.ค. 2566',
    status: 'rejected',
    description: 'ไม่อนุมัติ/แก้ไข',
  },
  {
    id: 'REQ-23080',
    title: 'คำร้องขอสอบซ้ำซ้อน',
    submittedDate: '01 พ.ย. 2566',
    status: 'completed',
    description: 'ดำเนินการเสร็จสิ้น',
  },
];

// Mock Data: เมนูยอดฮิต (พร้อม Class สีสำหรับ Tailwind)
const popularRequests = [
  { label: 'ขอใบรับรองผล (Transcript)', icon: 'i-heroicons-document-text', bg: 'bg-blue-100', text: 'text-blue-600' },
  { label: 'ขอหนังสือรับรองสถานภาพ', icon: 'i-heroicons-academic-cap', bg: 'bg-purple-100', text: 'text-purple-600' },
  { label: 'คำร้องขอลาพักการเรียน', icon: 'i-heroicons-pause-circle', bg: 'bg-orange-100', text: 'text-orange-600' },
  { label: 'คำร้องทั่วไป (General)', icon: 'i-heroicons-folder', bg: 'bg-gray-100', text: 'text-gray-600' },
];

// --- 2. Methods / Logic ---

// ฟังก์ชันนำทาง (ใช้ navigateTo ของ Nuxt)
function navigateToNewRequest() {
  // ในโปรเจกต์จริงใช้: return navigateTo('/new-request')
  console.warn('Navigating to New Request...');
}
</script>

<template>
  <div class="min-h-screen bg-gray-50/50">
    <!-- Main Content -->
    <UContainer class="space-y-8 pb-8">
      <!-- 1. Header & Greeting -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">
            สวัสดี, คุณสมชาย
          </h1>
          <p class="text-gray-500 mt-1 text-sm">
            รหัสนิสิต 63010xxx • คณะวิศวกรรมศาสตร์
          </p>
        </div>
        <UBadge color="neutral" variant="solid" size="md" class="px-3 py-1.5">
          <UIcon name="i-heroicons-calendar" class="mr-1.5 w-4 h-4" />
          ภาคเรียนที่ 1/2567
        </UBadge>
      </div>

      <!-- 2. Primary Action (Banner) -->
      <!-- ใช้ Div ผสมกับ UButton เพื่อความยืดหยุ่นในการทำ Background Gradient -->
      <div
        class="bg-linear-to-r from-primary-600 to-emerald-600 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden group cursor-pointer hover:scale-[1.005] transition-transform duration-300"
        @click="navigateToNewRequest"
      >
        <!-- Decorative Background Element -->
        <div class="absolute right-0 top-0 h-full w-1/3 bg-white/10 skew-x-12 translate-x-12 pointer-events-none" />

        <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 class="text-2xl font-bold mb-2">
              ยื่นคำร้องใหม่ออนไลน์
            </h2>
            <p class="text-white/90 max-w-lg">
              ระบบ E-Request สะดวก รวดเร็ว ติดตามสถานะได้ตลอด 24 ชม. ไม่ต้องเดินทางมาที่คณะ
            </p>
          </div>
          <UButton
            size="xl"
            color="success"
            variant="solid"
            label="สร้างคำร้องใหม่"
            icon="i-heroicons-plus-circle"
            class="text-primary-700 font-bold shadow-md"
          />
        </div>
      </div>

      <!-- 3. Popular Requests (Grid) -->
      <div>
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-heroicons-star" class="text-yellow-500 w-5 h-5" />
          <h3 class="font-semibold text-gray-800">
            คำร้องยอดนิยม
          </h3>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <UCard
            v-for="(item, index) in popularRequests"
            :key="index"
            class="cursor-pointer hover:ring-2 hover:ring-primary-500/20 transition-all hover:-translate-y-1"
          >
            <div class="flex flex-col items-center text-center gap-3">
              <div :class="`w-12 h-12 rounded-full ${item.bg} ${item.text} flex items-center justify-center transition-transform group-hover:scale-110`">
                <UIcon :name="item.icon" class="w-6 h-6" />
              </div>
              <span class="text-sm font-medium text-gray-700">{{ item.label }}</span>
            </div>
          </UCard>
        </div>
      </div>

      <!-- 4. Recent Requests (UTable) -->
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="text-gray-400 w-5 h-5" />
              <h3 class="font-semibold text-gray-800">
                รายการล่าสุด
              </h3>
            </div>
            <UButton to="/student/my-requests" variant="link" color="primary" label="ดูทั้งหมด" :padded="false" />
          </div>
        </template>

        <!-- UTable Implementation -->
        <UTable :data="recentRequests" class="w-full" :empty="t('noRecentRequests')" />
      </UCard>

      <!-- 5. Help Section -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 ">
        <div class="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start gap-4 hover:bg-blue-50 transition-colors">
          <div class="bg-white p-2.5 rounded-lg text-blue-600 shadow-sm flex items-center justify-center">
            <UIcon name="i-heroicons-book-open" class="w-5 h-5" />
          </div>
          <div>
            <h4 class="font-semibold text-gray-800 text-sm">
              คู่มือการใช้งาน
            </h4>
            <p class="text-xs text-gray-500 mt-1">
              ขั้นตอนการยื่นคำร้องและการติดตามสถานะ
            </p>
          </div>
        </div>
        <div class="bg-orange-50/50 border border-orange-100 rounded-xl p-4 flex items-start gap-4 hover:bg-orange-50 transition-colors">
          <div class="bg-white p-2.5 rounded-lg text-orange-600 shadow-sm flex items-center justify-center">
            <UIcon name="i-heroicons-phone" class="w-5 h-5" />
          </div>
          <div>
            <h4 class="font-semibold text-gray-800 text-sm">
              ติดต่อเจ้าหน้าที่
            </h4>
            <p class="text-xs text-gray-500 mt-1">
              พบปัญหาการใช้งาน หรือสอบถามข้อมูลเพิ่มเติม
            </p>
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>
