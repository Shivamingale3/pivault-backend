/** Account-password policy (FEATURES.md: max 16, upper, lower, digit, special). */
export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 16,
} as const;

export const NAME_MAX_LENGTH = 50;
export const EMAIL_MAX_LENGTH = 254;
