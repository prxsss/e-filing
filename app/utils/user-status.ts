import type { UserStatus } from '~~/shared/types/user-status';

import { USER_STATUS } from '~~/shared/types/user-status';

/**
 * Gets the color variant for a given user status.
 * @param status - The user status to get the color for
 * @returns A color variant string ('success', 'error', or 'neutral')
 * @example
 * const color = getUserStatusColor('active'); // returns 'success'
 */
export function getUserStatusColor(status: UserStatus): string {
  const colors: Record<UserStatus, string> = {
    [USER_STATUS.ACTIVE]: 'success',
    [USER_STATUS.INACTIVE]: 'neutral',
    [USER_STATUS.BANNED]: 'error',
  };
  return colors[status] || 'neutral';
}
