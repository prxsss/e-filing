export type RequestStatus = 'approved' | 'pending' | 'rejected' | 'action_required';

/**
 * Gets the color variant for a given request status.
 * @param status - The request status to get the color for
 * @returns A color variant string ('success', 'warning', 'error', or 'info')
 * @example
 * const color = getRequestStatusColor('approved'); // returns 'success'
 */
export function getRequestStatusColor(status: RequestStatus): string {
  const colors: Record<RequestStatus, string> = {
    approved: 'success',
    pending: 'warning',
    rejected: 'error',
    action_required: 'info',
  };
  return colors[status] || 'neutral';
}
