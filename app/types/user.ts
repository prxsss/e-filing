export type Role = {
  id: number;
  name: string;
  facultyId?: number | null;
  departmentId?: number | null;
};

export type UserListItem = {
  id: string;
  studentId?: string | null;
  staffId?: string | null;
  fullNameEn: string;
  fullNameTh: string;
  email: string;
  faculties: { nameEn: string; nameTh: string }[];
  roles: { name: string; count: number }[];
  banned: boolean;
};

export type UserDetail = {
  id: string;
  studentId?: string | null;
  staffId?: string | null;
  titleEn?: string | null;
  firstNameEn: string;
  lastNameEn: string;
  fullNameEn: string;
  titleTh?: string | null;
  firstNameTh: string;
  lastNameTh: string;
  fullNameTh: string;
  email: string;
  image: string | null;
  banned: boolean;
  createdAt: string;
  updatedAt: string;
  assignments: {
    role: string;
    faculty: {
      id: string;
      nameEn: string;
      nameTh: string;
    } | null;
    department: {
      id: string;
      nameEn: string;
      nameTh: string;
    } | null;
  }[];
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
};
