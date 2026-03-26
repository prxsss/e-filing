/* eslint-disable ts/consistent-type-definitions */
declare module '#auth-utils' {
  interface User {
    id: string;
    fullNameEn: string;
    fullNameTh: string;
    roles: string[];
    currentRole: string;
    permissions: string[];
  };

  interface UserSession {
    lastLoggedIn: Date;
  };
}

export {};
