/* eslint-disable ts/consistent-type-definitions */
declare module '#auth-utils' {
  interface User {
    id: string;
    fullName: string;
    roles: string[];
    currentRole: string;
    permissions: string[];
  };

  interface UserSession {
    lastLoggedIn: Date;
  };
}

export {};
