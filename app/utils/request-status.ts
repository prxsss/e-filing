export type RequestStatus = 'completed' | 'in_progress' | 'rejected';

/**
 * Gets the color variant for a given request status.
 * @param status - The request status to get the color for
 * @returns A color variant string ('success', 'warning', 'error', or 'info')
 * @example
 * const color = getRequestStatusColor('approved'); // returns 'success'
 */
export function getRequestStatusColor(status: RequestStatus): string {
  const colors: Record<RequestStatus, string> = {
    completed: 'success',
    in_progress: 'warning',
    rejected: 'error',
  };
  return colors[status] || 'neutral';
}
