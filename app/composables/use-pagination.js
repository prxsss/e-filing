export function usePagination(itemsPerPage = 10) {
  const currentPage = ref(1);
  const totalItems = ref(0);

  // Computed: Paginated items
  const getPaginatedItems = (items) => {
    const start = (currentPage.value - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return items.slice(start, end);
  };

  // Method: Change page
  const changePage = (page) => {
    currentPage.value = page;
    // Scroll to top of page when changing pages
    if (import.meta.client) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Method: Reset pagination
  const resetPagination = () => {
    currentPage.value = 1;
  };

  // Method: Set total items
  const setTotalItems = (total) => {
    totalItems.value = total;
  };

  return {
    currentPage,
    totalItems,
    itemsPerPage,
    getPaginatedItems,
    changePage,
    resetPagination,
    setTotalItems,
  };
}
