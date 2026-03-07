export type Role = {
  id: number;
  name: string;
};

export type UserListItem = {
  id: string;
  fullNameEn: string;
  fullNameTh: string;
  email: string;
  faculty: string | null;
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
