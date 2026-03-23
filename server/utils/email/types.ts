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
  studentEmail: string;
  studentId: string;
  faculty: string;
  department: string;
  documentTitle: string;
  totalSteps: number;
}
