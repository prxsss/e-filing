/* eslint-disable ts/consistent-type-definitions */
declare module 'h3' {
  interface H3EventContext {
    user?: import('#auth-utils').User;
  }
}

export {};
