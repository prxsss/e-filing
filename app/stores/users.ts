import type { UserDetail, UserListItem } from '~/types/user';

export const useUsersStore = defineStore('users', () => {
  const users = ref<UserListItem[] | null>(null);
  const user = ref<UserDetail | null>(null);
  const isLoading = ref(false);

  async function fetchUsers() {
    isLoading.value = true;
    try {
      const data = await $fetch<UserListItem[]>('/api/users');
      users.value = data ?? [];
    }
    finally {
      isLoading.value = false;
    }
  }

  async function fetchUserById(id: string) {
    isLoading.value = true;
    try {
      const data = await $fetch<UserDetail>(`/api/users/${id}`);
      user.value = data ?? null;
    }
    finally {
      isLoading.value = false;
    }
  }

  return {
    users,
    user,
    isLoading,
    fetchUsers,
    fetchUserById,
  };
});
