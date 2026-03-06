<script setup>
const props = defineProps({
  currentPage: {
    type: Number,
    required: true,
  },
  totalItems: {
    type: Number,
    required: true,
  },
  itemsPerPage: {
    type: Number,
    default: 10,
  },
  maxVisiblePages: {
    type: Number,
    default: 5,
  },
});

const emit = defineEmits(['pageChanged']);

// Computed: Total number of pages
const totalPages = computed(() => {
  return Math.ceil(props.totalItems / props.itemsPerPage);
});

// Computed: Visible page numbers
const visiblePages = computed(() => {
  const pages = [];
  const maxVisible = props.maxVisiblePages;
  const current = props.currentPage;
  const total = totalPages.value;

  let start = Math.max(2, current - Math.floor(maxVisible / 2));
  const end = Math.min(total - 1, start + maxVisible - 1);

  // Adjust start if we're near the end
  if (end - start < maxVisible - 1) {
    start = Math.max(2, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return pages;
});

// Computed: Show first page separately
const showFirstPage = computed(() => {
  return totalPages.value > 1;
});

// Computed: Show last page separately
const showLastPage = computed(() => {
  return totalPages.value > 1;
});

// Computed: Show first ellipsis
const showFirstEllipsis = computed(() => {
  return visiblePages.value.length > 0 && visiblePages.value[0] > 2;
});

// Computed: Show last ellipsis
const showLastEllipsis = computed(() => {
  return (
    visiblePages.value.length > 0
    && visiblePages.value[visiblePages.value.length - 1] < totalPages.value - 1
  );
});

// Method: Change page
function changePage(page) {
  if (page < 1 || page > totalPages.value || page === props.currentPage) {
    return;
  }
  emit('pageChanged', page);
}
</script>

<template>
  <div v-if="totalPages > 1" class="pagination-wrapper">
    <nav aria-label="Page navigation">
      <ul class="pagination pagination-sm justify-content-center mb-0">
        <!-- Previous Button -->
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <a
            class="page-link"
            href="#"
            aria-label="Previous"
            @click.prevent="changePage(currentPage - 1)"
          >
            <i class="fas fa-chevron-left" />
          </a>
        </li>

        <!-- First Page -->
        <li
          v-if="showFirstPage"
          class="page-item"
          :class="{ active: currentPage === 1 }"
        >
          <a class="page-link" href="#" @click.prevent="changePage(1)">1</a>
        </li>

        <!-- First Ellipsis -->
        <li v-if="showFirstEllipsis" class="page-item disabled">
          <span class="page-link">...</span>
        </li>

        <!-- Middle Pages -->
        <li
          v-for="page in visiblePages"
          :key="page"
          class="page-item"
          :class="{ active: currentPage === page }"
        >
          <a class="page-link" href="#" @click.prevent="changePage(page)">
            {{ page }}
          </a>
        </li>

        <!-- Last Ellipsis -->
        <li v-if="showLastEllipsis" class="page-item disabled">
          <span class="page-link">...</span>
        </li>

        <!-- Last Page -->
        <li
          v-if="showLastPage"
          class="page-item"
          :class="{ active: currentPage === totalPages }"
        >
          <a class="page-link" href="#" @click.prevent="changePage(totalPages)">
            {{ totalPages }}
          </a>
        </li>

        <!-- Next Button -->
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <a
            class="page-link"
            href="#"
            aria-label="Next"
            @click.prevent="changePage(currentPage + 1)"
          >
            <i class="fas fa-chevron-right" />
          </a>
        </li>
      </ul>
    </nav>

    <!-- Page Info -->
    <div class="page-info">
      <small class="text-muted">
        Page {{ currentPage }} of {{ totalPages }} ({{ totalItems }} total
        items)
      </small>
    </div>
  </div>
</template>

<style scoped>
.pagination-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0;
  margin-top: 1rem;
}

.pagination {
  margin-bottom: 0;
}

.page-item {
  margin: 0 2px;
}

.page-link {
  border: 1px solid #dee2e6;
  color: #495057;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.page-link:hover {
  background-color: #f8f9fa;
  border-color: #c1c9d0;
  color: #007bff;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.page-link:focus {
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.15);
  outline: none;
}

.page-item.active .page-link {
  background-color: #007bff;
  border-color: #007bff;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 123, 255, 0.3);
}

.page-item.disabled .page-link {
  background-color: #f8f9fa;
  border-color: #dee2e6;
  color: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.page-item.disabled .page-link:hover {
  transform: none;
  box-shadow: none;
}

.page-info {
  text-align: center;
}

.page-info small {
  font-size: 0.8rem;
  color: #6c757d;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .page-link {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
  }

  .pagination {
    flex-wrap: wrap;
  }
}
</style>
