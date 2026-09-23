/**
 * The one interface every identity provider implements (mock today, Dojah
 * later). The verify-identity Edge Function only ever talks to this
 * interface, so swapping providers never touches the function itself.
 */

export type IdentityCheckType = 'bvn' | 'nin';

export type IdentityCheckStatus = 'verified' | 'mismatch' | 'not_found' | 'error';

export interface VerifyIdentityInput {
  type: IdentityCheckType;
  /** The raw 11-digit number. Only ever held in memory for the provider
   * call — never log it, return it, or put it in an error message. */
  number: string;
  /** From the user's profile, for the provider's name matching. */
  fullName: string;
}

export interface VerifyIdentityResult {
  status: IdentityCheckStatus;
  /** The provider's own ID for this lookup, kept for support/audit. */
  reference?: string;
  /** Internal detail for server logs only. Never sent to the app. */
  message?: string;
}

export interface IdentityProvider {
  /** Stored as identity_provider / provider on the database rows. */
  name: string;
  verifyIdentity(input: VerifyIdentityInput): Promise<VerifyIdentityResult>;
}
