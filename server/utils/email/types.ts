/* eslint-disable ts/consistent-type-definitions */
export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export interface EmailAdapter {
  send: (payload: EmailPayload) => Promise<void>;
}

export interface SignRequestContext {
  requestId: number;
  studentName: string;
  studentNameTh: string;
  studentNameEn: string;
  studentEmail: string;
  studentId: string;
  faculty: string;
  facultyTh: string;
  facultyEn: string;
  department: string;
  departmentTh: string;
  departmentEn: string;
  documentTitle: string;
  totalSteps: number;
}
