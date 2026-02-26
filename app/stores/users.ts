import type { User } from '~/types/user';

export const useUsersStore = defineStore('users', () => {
  const users = ref<User[] | null>(null);
  const user = ref<User | null>(null);
  const isLoading = ref(false);

  async function fetchUsers() {
    isLoading.value = true;
    try {
      const data = await $fetch<User[]>('/api/users', { query: {
        include: 'roles',
      } });
      users.value = data ?? [];
    }
    finally {
      isLoading.value = false;
    }
  }

  async function fetchUserById(id: number) {
    isLoading.value = true;
    try {
      const data = await $fetch<User>(`/api/users/${id}`, { query: {
        include: 'roles',
      } });
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
