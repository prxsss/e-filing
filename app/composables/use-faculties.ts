export function useFaculties() {
  const page = ref(1);
  const pageSize = ref(5);

  const { data, status, refresh } = useFetch('/api/admin/faculties', {
    query: computed(() => ({
      page: page.value,
      pageSize: pageSize.value,
    })),
  });

  const total = computed(() => data.value?.total || 0);
  const totalPages = computed(() => Math.ceil(total.value / pageSize.value));

  const hasPrev = computed(() => page.value > 1);
  const hasNext = computed(() => page.value < totalPages.value);

  function prevPage() {
    if (hasPrev.value)
      page.value--;
  }

  function nextPage() {
    if (hasNext.value)
      page.value++;
  }

  return {
    rows: computed(() => data.value?.rows ?? []),
    total,
    totalPages,
    page,
    pageSize,
    hasPrev,
    hasNext,
    prevPage,
    nextPage,
    refresh,
    isLoading: computed(() => status.value === 'pending'),
  };
}
