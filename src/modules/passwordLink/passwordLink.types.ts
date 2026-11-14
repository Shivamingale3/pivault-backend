import type { ResetPurpose } from '../passwordReset/passwordReset.constants.js';

export interface LinkStatus {
  purpose: ResetPurpose;
  expiresAt: Date;
}
