export type UserStatus = 'active' | 'pending' | 'suspended' | 'deleted';

/**
 * Gets the color variant for a given user status.
 * @param status - The user status to get the color for
 * @returns A color variant string ('success', 'warning', 'error', or 'neutral')
 * @example
 * const color = getUserStatusColor('active'); // returns 'success'
 */
export function getUserStatusColor(status: UserStatus): string {
  const colors: Record<UserStatus, string> = {
    active: 'success',
    pending: 'warning',
    suspended: 'error',
    deleted: 'neutral',
  };
  return colors[status] || 'neutral';
}
