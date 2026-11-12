/** What a reset link was issued for. Onboarding links live longer: nobody is waiting at a screen. */
export const ResetPurpose = {
  Onboarding: 'onboarding',
  Reset: 'reset',
} as const;

export type ResetPurpose = (typeof ResetPurpose)[keyof typeof ResetPurpose];

export const ONBOARDING_LINK_HOURS = 24;
/** FEATURES.md: forgot-password tokens live 15 minutes. */
export const RESET_LINK_MINUTES = 15;

export const RESET_TOKEN_TTL_SECONDS: Record<ResetPurpose, number> = {
  [ResetPurpose.Onboarding]: ONBOARDING_LINK_HOURS * 60 * 60,
  [ResetPurpose.Reset]: RESET_LINK_MINUTES * 60,
};
