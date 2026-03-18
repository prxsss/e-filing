export function useDepartments() {
  const page = ref(1);
  const pageSize = ref(5);

  const { data, status, refresh } = useFetch('/api/admin/departments', {
    query: computed(() => ({
      page: page.value,
      pageSize: pageSize.value,
    })),
  });

  const total = computed(() => data.value?.total || 0);

  return {
    rows: computed(() => data.value?.rows ?? []),
    total,
    page,
    pageSize,
    refresh,
    isLoading: computed(() => status.value === 'pending'),
  };
}
