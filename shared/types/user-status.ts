export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BANNED: 'banned',
} as const;

export const USER_STATUS_VALUES = [
  USER_STATUS.ACTIVE,
  USER_STATUS.INACTIVE,
  USER_STATUS.BANNED,
] as const;

export type UserStatus = (typeof USER_STATUS_VALUES)[number];

export function isUserStatus(value: unknown): value is UserStatus {
  return typeof value === 'string' && (USER_STATUS_VALUES as readonly string[]).includes(value);
}
