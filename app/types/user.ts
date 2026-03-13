export type Role = {
  id: number;
  name: string;
  facultyId?: number | null;
  departmentId?: number | null;
};

export type UserListItem = {
  id: string;
  fullNameEn: string;
  fullNameTh: string;
  email: string;
  facultyId: number | null;
  facultyNameEn: string | null;
  facultyNameTh: string | null;
  departmentId: number | null;
  departmentNameEn: string | null;
  departmentNameTh: string | null;
  banned: boolean;
  roles?: string[];
};

export type UserDetail = {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  fullNameEn: string;
  firstNameTh: string;
  lastNameTh: string;
  fullNameTh: string;
  email: string;
  roles: Role[];
  facultyId: number | null;
  facultyName: string | null;
  image: string | null;
  banned: boolean;
  createdAt: Date;
  updatedAt: Date;
};
