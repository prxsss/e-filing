export type Role = {
  id: number;
  name: string;
};

export type UserListItem = {
  id: string;
  fullNameEN: string;
  fullNameTH: string;
  email: string;
  faculty: string | null;
  banned: boolean;
  roles?: string[];
};

export type UserDetail = {
  id: string;
  firstNameEN: string;
  lastNameEN: string;
  fullNameEN: string;
  firstNameTH: string;
  lastNameTH: string;
  fullNameTH: string;
  email: string;
  roles: Role[];
  facultyId: number | null;
  facultyName: string | null;
  image: string | null;
  banned: boolean;
  createdAt: Date;
  updatedAt: Date;
};
