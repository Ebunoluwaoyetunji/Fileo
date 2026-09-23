/**
 * Dojah provider — NOT IMPLEMENTED YET. Selecting it (IDENTITY_PROVIDER=dojah)
 * makes every check come back as "error" until this file is filled in.
 *
 * To switch to Dojah later:
 *   1. Fill in verifyIdentity() below (outline in the comments).
 *   2. Add the secrets in Supabase (Edge Functions -> Secrets), never in the
 *      app or the repo:
 *        DOJAH_APP_ID      your Dojah App ID
 *        DOJAH_SECRET_KEY  your Dojah secret key
 *        DOJAH_BASE_URL    https://sandbox.dojah.io while testing,
 *                          https://api.dojah.io for live
 *   3. Change the IDENTITY_PROVIDER secret from "mock" to "dojah" and
 *      redeploy verify-identity.
 * Nothing else changes: the Edge Function, database and app only see the
 * shared result shape from types.ts.
 */
import type { IdentityProvider } from './types.ts';

export const dojahProvider: IdentityProvider = {
  name: 'dojah',

  verifyIdentity(_input) {
    // Outline for the real implementation. Confirm the endpoint paths,
    // query parameters and response fields against Dojah's current API
    // docs before relying on them.
    //
    // const appId = Deno.env.get('DOJAH_APP_ID');
    // const secretKey = Deno.env.get('DOJAH_SECRET_KEY');
    // const baseUrl = Deno.env.get('DOJAH_BASE_URL') ?? 'https://api.dojah.io';
    // if (!appId || !secretKey) {
    //   return { status: 'error', message: 'dojah: missing DOJAH_APP_ID / DOJAH_SECRET_KEY' };
    // }
    //
    // Request: one lookup per check, with the key headers, e.g.
    //   BVN: GET {baseUrl}/api/v1/kyc/bvn?bvn=<number>&first_name=<...>&last_name=<...>
    //   NIN: GET {baseUrl}/api/v1/kyc/nin?nin=<number>
    // const response = await fetch(url, {
    //   headers: { AppId: appId, Authorization: secretKey },
    // });
    //
    // Map the response onto the shared statuses:
    //   record found and name matches -> { status: 'verified', reference: <Dojah's reference/request ID> }
    //   record found, name differs    -> { status: 'mismatch' }
    //   number not found              -> { status: 'not_found' }
    //   anything else (timeouts, 5xx) -> { status: 'error' }
    // Compare names in code (case/spacing-insensitive, first + last name)
    // rather than trusting a single match flag, and decide how strict to be
    // with middle names.
    //
    // Privacy: never put the number, the URL containing it, or Dojah's raw
    // response (it holds personal data) into `message`, a thrown error, or a
    // console.log. Only the status and reference leave this file.
    throw new Error('Dojah provider not configured yet');
  },
};
