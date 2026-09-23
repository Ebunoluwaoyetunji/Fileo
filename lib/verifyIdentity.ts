/**
 * Calls the verify-identity Supabase Edge Function for one BVN or NIN.
 *
 * The server makes the actual decision and is the only thing allowed to
 * mark a profile verified. This just turns every possible outcome
 * (including HTTP errors and no network) into one simple status the screen
 * can switch on. Never throws.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type IdentityCheckType = 'bvn' | 'nin';

export type VerifyIdentityStatus = 'verified' | 'mismatch' | 'not_found' | 'error' | 'rate_limited';

export type VerifyIdentityResult = {
  status: VerifyIdentityStatus;
  /** Only used for rate_limited, where the server's wording (the limit and
   * when to retry) is the useful part. */
  message?: string;
};

const PROVIDER_STATUSES: VerifyIdentityStatus[] = ['verified', 'mismatch', 'not_found', 'error'];

export async function verifyIdentity(
  type: IdentityCheckType,
  number: string
): Promise<VerifyIdentityResult> {
  try {
    const { data, error } = await supabase.functions.invoke<{ status?: string; message?: string }>(
      'verify-identity',
      { body: { type, number } }
    );

    if (!error) {
      const status = data?.status as VerifyIdentityStatus | undefined;
      return status && PROVIDER_STATUSES.includes(status) ? { status } : { status: 'error' };
    }

    // Non-2xx from the function. Only 429 needs special handling; 400/401/
    // 500 all show the generic message (the app already checks the format,
    // and supabase-js refreshes the session token by itself).
    if (error instanceof FunctionsHttpError && (error.context as Response)?.status === 429) {
      let message: string | undefined;
      try {
        message = (await (error.context as Response).json())?.message;
      } catch {
        // fall back to the screen's own copy
      }
      return { status: 'rate_limited', message };
    }
    return { status: 'error' };
  } catch {
    // No connection, DNS failure, etc.
    return { status: 'error' };
  }
}
