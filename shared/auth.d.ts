/* eslint-disable ts/consistent-type-definitions */
declare module '#auth-utils' {
  interface User {
    id: string;
    studentId?: string;
    staffId?: string;
    titleEn?: string;
    fullNameEn: string;
    titleTh?: string;
    fullNameTh: string;
    roles: string[];
    currentRole: string;
    permissions: string[];
    typePerson?: string;
    campus?: string;
    email?: string;
    idToken?: string;
    authProvider?: 'local' | 'ku-all-login';
  };

  interface UserSession {
    lastLoggedIn: Date;
  };
}

export {};
