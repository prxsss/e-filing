// Type definitions for request data
export type RequestStatus = 'Approved' | 'In Progress' | 'Rejected' | 'Draft';

export type Request = {
  id: string;
  title: string;
  date: string;
  status: RequestStatus;
  signer: string;
  progress: number;
  description: string;
  category: string;
  estimatedTime: string;
  reason?: string;
  attachments: string[];
  submittedBy: string;
  updatedDate: string;
};

// Mock data - easy to swap with API calls
const mockRequests: Request[] = [
  {
    id: 'REQ-2024-001',
    title: 'Late Registration (Course 01204)',
    date: '2024-01-10',
    status: 'Approved',
    signer: 'Dean of Engineering',
    progress: 100,
    description: 'Request to register for course 01204 after the standard registration deadline. The course is required for the current semester and is critical for academic progress.',
    category: 'Academic',
    estimatedTime: '3-5 Days',
    attachments: ['Course_Declaration.pdf', 'Transcript.pdf'],
    submittedBy: 'Somsak Jai-dee',
    updatedDate: '2024-01-12',
  },
  {
    id: 'REQ-2024-002',
    title: 'Tuition Fee Installment',
    date: '2024-01-12',
    status: 'In Progress',
    signer: 'Dr. Suthep Panya',
    progress: 60,
    description: 'Request for approval of tuition fee payment installment plan. Student needs to pay in 3 installments due to temporary financial constraints.',
    category: 'Financial',
    estimatedTime: '5-7 Days',
    attachments: ['Income_Letter.pdf'],
    submittedBy: 'Somsak Jai-dee',
    updatedDate: '2024-01-15',
  },
  {
    id: 'REQ-2024-003',
    title: 'Activity Room Booking',
    date: '2024-01-15',
    status: 'Rejected',
    signer: 'Building Manager',
    progress: 100,
    description: 'Request to book the main activity room for club meeting on January 20, 2024.',
    category: 'Facilities',
    estimatedTime: '1 Day',
    reason: 'Room unavailable due to renovation. Please reschedule for February or later.',
    attachments: [],
    submittedBy: 'Somsak Jai-dee',
    updatedDate: '2024-01-15',
  },
  {
    id: 'REQ-2024-004',
    title: 'Add/Drop Course Request',
    date: '2024-01-18',
    status: 'Draft',
    signer: '-',
    progress: 0,
    description: 'Request to add 2 more courses and drop 1 course for the current semester.',
    category: 'Academic',
    estimatedTime: '2-3 Days',
    attachments: [],
    submittedBy: 'Somsak Jai-dee',
    updatedDate: '2024-01-18',
  },
  {
    id: 'REQ-2024-005',
    title: 'Equipment Borrowing Request',
    date: '2024-01-16',
    status: 'Approved',
    signer: 'Lab Manager',
    progress: 100,
    description: 'Request to borrow laboratory equipment (Oscilloscope) for graduation project duration.',
    category: 'Facilities',
    estimatedTime: '1 Day',
    attachments: ['Project_Plan.pdf', 'Lab_Safety_Cert.pdf'],
    submittedBy: 'Somsak Jai-dee',
    updatedDate: '2024-01-17',
  },
  {
    id: 'REQ-2024-006',
    title: 'Academic Transcript Request',
    date: '2024-01-19',
    status: 'In Progress',
    signer: 'Registrar Office',
    progress: 75,
    description: 'Request for official academic transcript with seal for exchange student application to overseas university.',
    category: 'Academic',
    estimatedTime: '2-3 Days',
    attachments: ['Exchange_Program_Letter.pdf'],
    submittedBy: 'Somsak Jai-dee',
    updatedDate: '2024-01-19',
  },
  {
    id: 'REQ-2024-007',
    title: 'Tuition Waiver Application',
    date: '2024-01-20',
    status: 'Draft',
    signer: '-',
    progress: 0,
    description: 'Application for partial tuition fee waiver based on financial hardship and academic merit.',
    category: 'Financial',
    estimatedTime: '7-10 Days',
    attachments: [],
    submittedBy: 'Somsak Jai-dee',
    updatedDate: '2024-01-20',
  },
  {
    id: 'REQ-2024-008',
    title: 'Change of Advisor Request',
    date: '2024-01-14',
    status: 'Rejected',
    signer: 'Department Head',
    progress: 100,
    description: 'Request to change thesis advisor due to change in research focus.',
    category: 'Academic',
    estimatedTime: '3-5 Days',
    reason: 'Current advisor has accepted your request. No change needed. Please proceed with current advisor.',
    attachments: [],
    submittedBy: 'Somsak Jai-dee',
    updatedDate: '2024-01-16',
  },
];

/**
 * Composable for managing requests
 * Provides functions to fetch requests with easy API integration
 */
export function useRequests() {
  /**
   * Get all requests or filter by status
   * @param status - Optional status filter
   * @returns Filtered requests
   */
  const getRequests = async (status?: RequestStatus): Promise<Request[]> => {
    // TODO: Replace with API call
    // const { data } = await $fetch('/api/requests', { query: { status } });
    // return data;

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API latency

    if (!status)
      return mockRequests;
    return mockRequests.filter(req => req.status === status);
  };

  /**
   * Get a single request by ID
   * @param id - Request ID
   * @returns Request or null if not found
   */
  const getRequestById = async (id: string): Promise<Request | null> => {
    // TODO: Replace with API call
    // const { data } = await $fetch(`/api/requests/${id}`);
    // return data;

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API latency

    return mockRequests.find(req => req.id === id) || null;
  };

  /**
   * Search requests by title
   * @param query - Search query
   * @returns Filtered requests
   */
  const searchRequests = async (query: string): Promise<Request[]> => {
    // TODO: Replace with API call
    // const { data } = await $fetch('/api/requests/search', { query: { q: query } });
    // return data;

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API latency

    if (!query.trim())
      return mockRequests;
    const lowerQuery = query.toLowerCase();
    return mockRequests.filter(req => req.title.toLowerCase().includes(lowerQuery));
  };

  /**
   * Get all unique request statuses
   */
  const getStatuses = (): RequestStatus[] => {
    return ['Draft', 'In Progress', 'Approved', 'Rejected'];
  };

  return {
    getRequests,
    getRequestById,
    searchRequests,
    getStatuses,
  };
}
