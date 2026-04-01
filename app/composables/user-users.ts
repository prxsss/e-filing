import type { UserStatus } from '~~/shared/types/user-status';

type UserSearchFilters = {
  search?: Ref<string>;
  facultyId?: Ref<number | null | undefined>;
  departmentId?: Ref<number | null | undefined>;
  roleId?: Ref<number | null | undefined>;
  status?: Ref<UserStatus | null | undefined>;
};

export function useUsers(filters: UserSearchFilters = {}) {
  const page = ref(1);
  const pageSize = ref(5);

  const { data, status, refresh } = useFetch('/api/users', {
    query: computed(() => ({
      page: page.value,
      pageSize: pageSize.value,
      search: filters.search?.value?.trim() || undefined,
      facultyId: filters.facultyId?.value ?? undefined,
      departmentId: filters.departmentId?.value ?? undefined,
      roleId: filters.roleId?.value ?? undefined,
      status: filters.status?.value ?? undefined,
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
