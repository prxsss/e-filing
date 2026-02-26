import type { UserStatus } from '~/utils/user-status';

export type Role = {
  id: number;
  name: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  institutionId: string;
  status: UserStatus;
  roles?: Role[];
  facultyId?: number;
  faculty?: string;
  image?: string;
  signature?: string;
  createdAt: Date;
  updatedAt: Date;
};
