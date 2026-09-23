/**
 * verify-identity — checks one BVN or NIN for the signed-in user.
 *
 * POST { type: 'bvn' | 'nin', number: '<11 digits>' }
 *   -> { status, message } and nothing else.
 *
 * The app sends two requests, one per number. A user becomes
 * identity_verified only when BOTH their NIN and BVN have passed. Each
 * passing check stores that number's masked form (e.g. "*******4567"), and
 * the check that completes the pair also sets identity_verified and the
 * identity_* details.
 *
 * Responses:
 *   200  status: 'verified' | 'mismatch' | 'not_found' | 'error'  (the provider's answer)
 *   400  status: 'invalid_request'   bad JSON, type or number
 *   401  status: 'unauthorized'      no or invalid session
 *   405  status: 'invalid_request'   not a POST
 *   429  status: 'rate_limited'      5+ verified/mismatch/not_found results
 *                                    in the last 24 hours (errors don't count)
 *   500  status: 'error'             our own failure (database, config)
 *
 * An already-verified user gets 'verified' straight away, without using an
 * attempt or calling the provider.
 *
 * The raw number is masked as soon as it passes validation. Only the masked
 * form is stored or logged; the raw value is only handed to the provider.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  getIdentityProvider,
  type IdentityCheckStatus,
  type IdentityCheckType,
  type IdentityProvider,
} from '../_shared/identity/index.ts';

const MAX_ATTEMPTS_PER_DAY = 5;
/** Results that use up one of the day's attempts. 'error' is left out. */
const RATE_LIMITED_RESULTS: IdentityCheckStatus[] = ['verified', 'mismatch', 'not_found'];
const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_LABEL: Record<IdentityCheckType, string> = { bvn: 'BVN', nin: 'NIN' };

type ResponseStatus = IdentityCheckStatus | 'invalid_request' | 'unauthorized' | 'rate_limited';

const MESSAGES = {
  mismatch: "The details don't match the name on your account.",
  not_found: "We couldn't find this number. Check it and try again.",
  error: 'Something went wrong. Please try again.',
  rate_limited:
    "You've reached the limit of 5 verification attempts in 24 hours. Please try again tomorrow.",
  unauthorized: 'Please sign in again to verify your identity.',
  fully_verified: 'Your identity has been verified.',
};

function reply(httpStatus: number, status: ResponseStatus, message: string) {
  return Response.json({ status, message }, { status: httpStatus, headers: corsHeaders });
}

/** "12345678901" -> "*******8901". Same shape the database constraints require. */
function maskNumber(number: string) {
  return `${'*'.repeat(7)}${number.slice(-4)}`;
}

/** The secret (service role) key. New-style projects expose it in
 * SUPABASE_SECRET_KEYS; older ones as SUPABASE_SERVICE_ROLE_KEY. Both are
 * provided by Supabase automatically; neither is set by hand. */
function getServiceKey(): string | undefined {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      if (parsed.default) {
        return parsed.default;
      }
    } catch {
      // fall through to the legacy key
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

function createAdminClient(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL');
  const key = getServiceKey();
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type ProfileRow = {
  full_name: string | null;
  identity_verified: boolean;
  bvn_masked: string | null;
  nin_masked: string | null;
};

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return reply(405, 'invalid_request', 'Use POST.');
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error('verify-identity: SUPABASE_URL or the secret key is not available');
    return reply(500, 'error', MESSAGES.error);
  }

  // 1. Signed-in user, from the Authorization header's JWT.
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return reply(401, 'unauthorized', MESSAGES.unauthorized);
  }
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return reply(401, 'unauthorized', MESSAGES.unauthorized);
  }

  // 2. Validate input, then mask straight away.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, 'invalid_request', 'Send a JSON body like { "type": "bvn", "number": "..." }.');
  }
  const { type, number } = (body ?? {}) as { type?: unknown; number?: unknown };
  if (type !== 'bvn' && type !== 'nin') {
    return reply(400, 'invalid_request', 'type must be "bvn" or "nin".');
  }
  if (typeof number !== 'string' || !/^\d{11}$/.test(number)) {
    return reply(400, 'invalid_request', `Your ${CHECK_LABEL[type]} must be exactly 11 digits.`);
  }
  const masked = maskNumber(number);

  // 3. Profile: name for matching, and current verification state.
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('full_name, identity_verified, bvn_masked, nin_masked')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();
  if (profileError || !profile) {
    console.error('verify-identity: could not load profile', profileError?.message ?? 'no row');
    return reply(500, 'error', MESSAGES.error);
  }
  if (profile.identity_verified) {
    // Nothing left to check; don't spend a provider call or an attempt.
    return reply(200, 'verified', MESSAGES.fully_verified);
  }

  // 4. Rate limit. Only real answers count: provider 'error' results are
  //    still logged below but don't use up the user's attempts, since they
  //    say nothing about the number. If the count can't be read, refuse
  //    rather than risk unlimited provider calls.
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count, error: countError } = await admin
    .from('identity_verification_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('result', RATE_LIMITED_RESULTS)
    .gte('created_at', since);
  if (countError || count === null) {
    console.error('verify-identity: could not count attempts', countError?.message);
    return reply(500, 'error', MESSAGES.error);
  }
  if (count >= MAX_ATTEMPTS_PER_DAY) {
    return reply(429, 'rate_limited', MESSAGES.rate_limited);
  }

  // 5. Ask the provider. A misconfigured IDENTITY_PROVIDER is our fault, so
  //    it fails here without using up one of the user's attempts. A
  //    provider that throws (e.g. Dojah not configured yet) counts as an
  //    'error' attempt.
  let provider: IdentityProvider;
  try {
    provider = getIdentityProvider();
  } catch (error) {
    console.error('verify-identity:', error instanceof Error ? error.message : 'bad IDENTITY_PROVIDER');
    return reply(500, 'error', MESSAGES.error);
  }
  let status: IdentityCheckStatus = 'error';
  let reference: string | null = null;
  try {
    const result = await provider.verifyIdentity({ type, number, fullName: profile.full_name ?? '' });
    status = ['verified', 'mismatch', 'not_found'].includes(result.status) ? result.status : 'error';
    reference = result.reference ?? null;
    if (status === 'error' && result.message) {
      console.error(`verify-identity: provider ${provider.name} error: ${result.message}`);
    }
  } catch (error) {
    console.error(
      `verify-identity: provider ${provider.name} threw:`,
      error instanceof Error ? error.message : 'unknown error'
    );
  }
  const providerName = provider.name;

  // 6. Log every attempt. It also feeds the rate limit, so if it can't be
  //    written, don't mark anything verified on its strength.
  const { error: logError } = await admin.from('identity_verification_attempts').insert({
    user_id: user.id,
    check_type: type,
    masked_number: masked,
    result: status,
    provider: providerName,
    provider_reference: reference,
  });
  if (logError) {
    console.error('verify-identity: could not log attempt', logError.message);
    return reply(500, 'error', MESSAGES.error);
  }

  if (status !== 'verified') {
    return reply(200, status, MESSAGES[status]);
  }

  // 7. Passed: store this number's masked form. If the other number has
  //    already passed too, the user is now fully verified.
  const otherMasked = type === 'bvn' ? profile.nin_masked : profile.bvn_masked;
  const isComplete = otherMasked !== null;
  const update: Record<string, unknown> = { [`${type}_masked`]: masked };
  if (isComplete) {
    Object.assign(update, {
      identity_verified: true,
      identity_verified_at: new Date().toISOString(),
      identity_check_type: type,
      identity_provider: providerName,
      identity_reference: reference,
    });
  }
  const { error: updateError } = await admin.from('profiles').update(update).eq('id', user.id);
  if (updateError) {
    console.error('verify-identity: could not update profile', updateError.message);
    return reply(500, 'error', MESSAGES.error);
  }

  return reply(
    200,
    'verified',
    isComplete ? MESSAGES.fully_verified : `Your ${CHECK_LABEL[type]} has been verified.`
  );
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (error) {
    console.error('verify-identity: unexpected error', error instanceof Error ? error.message : 'unknown');
    return reply(500, 'error', MESSAGES.error);
  }
});
