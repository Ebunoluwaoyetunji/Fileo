/**
 * Auth/session state shared across the whole app, backed by Supabase Auth
 * plus the `profiles` table (one row per auth user — created server-side by
 * the on_auth_user_created trigger at sign-up, from the full_name/phone
 * passed in signUp's metadata).
 *
 * Sign-up flow (email confirmation is ON in the Supabase project, and the
 * "Confirm signup" email template sends {{ .Token }}, i.e. a 6-digit code):
 *   signUp()  -> Supabase emails a code, no session yet
 *   verifySignUpCode() -> code accepted, session created
 *   Identity Verification screen -> verify-identity Edge Function checks
 *     NIN + BVN server-side and updates the profile row; the screen then
 *     calls refreshProfile() to pick up identity_verified.
 *
 * The app can't write identity_verified, the identity_* columns or the
 * masked NIN/BVN — a database trigger rejects that from signed-in users.
 * Only the Edge Function (service role) can.
 *
 * Every action resolves (never throws) with a display-ready `error` string
 * or null, so screens can drop it straight into a field error or toast.
 */
import type { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  bvn_masked: string | null;
  nin_masked: string | null;
  identity_verified: boolean;
  identity_verified_at: string | null;
  identity_check_type: 'bvn' | 'nin' | null;
  identity_provider: string | null;
  identity_reference: string | null;
  created_at: string;
};

export type AuthResult = {
  error: string | null;
  /** Supabase's machine-readable error code, for the few places a screen
   * branches on the kind of failure (e.g. Sign In on email_not_confirmed). */
  code?: string;
};

type SignUpInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

/** The only profile fields the app itself may change. */
type ProfileWrite = Partial<Pick<Profile, 'full_name' | 'phone'>>;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** The signed-in user's `profiles` row, or null when signed out (or if it
   * couldn't be loaded). */
  profile: Profile | null;
  /** True until the stored session has been restored and — if there is
   * one — that user's profile row has been loaded. Routing decisions (e.g.
   * app/index.tsx) should wait for this. */
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  verifySignUpCode: (email: string, code: string) => Promise<AuthResult>;
  resendSignUpCode: (email: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  /** Profile's "Personal information" edit form. */
  updateProfile: (updates: ProfileWrite) => Promise<AuthResult>;
  /** Re-reads the signed-in user's profile row (e.g. after the server has
   * verified their identity) and returns it, or null if it couldn't be
   * loaded. */
  refreshProfile: () => Promise<Profile | null>;

  /** Forgot Password step 1: emails a 6-digit recovery code if an account
   * exists. Deliberately reports success for unknown emails too (see the
   * implementation) so the screen can't reveal who has an account. */
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  /** Forgot Password step 2: checks the code; on success the user is
   * signed in (in a "recovery" session) so they can set a new password. */
  verifyPasswordResetCode: (email: string, code: string) => Promise<AuthResult>;
  /** Forgot Password step 3: saves the new password. Supabase signs out
   * every other session when a password changes. */
  setNewPassword: (password: string) => Promise<AuthResult>;
  /** Profile > Change password: checks the current password, then saves the
   * new one. Other sessions are signed out; this device stays signed in. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  /** Profile > email: asks Supabase to email confirmation codes (to the new
   * address, and to the current one too when "Secure email change" is on). */
  requestEmailChange: (newEmail: string) => Promise<AuthResult>;
  /** Confirms one email-change code. `complete` is true once the change has
   * gone through; false means this code was accepted but the code from the
   * other inbox is still needed ("Secure email change"). */
  verifyEmailChangeCode: (email: string, code: string) => Promise<AuthResult & { complete?: boolean }>;
  /** Sends fresh email-change codes (both inboxes). Earlier codes stop
   * working, so both have to be entered again. */
  resendEmailChangeCodes: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const NETWORK_ERROR_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

// Friendlier copy for the codes users will realistically hit. Anything not
// listed falls through to Supabase's own message, which for things like
// weak_password or rate limits already says exactly what to fix (e.g.
// "you can only request this after 42 seconds").
const FRIENDLY_AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please verify your email address first.',
  user_already_exists: 'An account with this email already exists. Log in instead.',
  email_exists: 'An account with this email already exists. Log in instead.',
  otp_expired: 'That code is incorrect or has expired.',
  same_password: 'Your new password must be different from your current one.',
  // Supabase's actual code for a wrong current_password (the server-side
  // check); the app's own sign-in check reports the same code.
  current_password_invalid: 'Your current password is incorrect.',
  email_address_invalid: 'Enter a valid email address.',
  // Only if "Secure password change" is turned on in Supabase and the
  // session is over 24 hours old; changePassword() signs in fresh first, so
  // this shouldn't normally be reachable.
  reauthentication_needed: 'For your security, sign out and sign back in, then try again.',
};

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please start again.';

function toAuthResult(error: { message: string; code?: string; name?: string; status?: number }): AuthResult {
  // supabase-js reports a failed fetch (offline, DNS, blocked) as a
  // "retryable" error with no HTTP status.
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return { error: NETWORK_ERROR_MESSAGE, code: 'network' };
  }
  const friendly = error.code ? FRIENDLY_AUTH_MESSAGES[error.code] : undefined;
  return { error: friendly ?? error.message, code: error.code };
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle<Profile>();
  return error ? null : data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionRestored, setIsSessionRestored] = useState(false);
  // Keyed by user id so a profile can never be shown for the wrong user
  // mid-switch, and so "has the current user's profile loaded yet?" is a
  // direct comparison rather than a separate loading flag to keep in sync.
  const [loadedProfile, setLoadedProfile] = useState<{
    userId: string;
    profile: Profile | null;
  } | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    // INITIAL_SESSION fires once the client has restored whatever session
    // was persisted (AsyncStorage on native, localStorage on web).
    // Only state is set here — Supabase warns against awaiting other
    // supabase calls inside this callback (it can deadlock the client's
    // internal auth lock), so the profile fetch reacts to `session` below.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'INITIAL_SESSION') {
        setIsSessionRestored(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setLoadedProfile(null);
      return;
    }
    let cancelled = false;
    fetchProfile(userId).then((profile) => {
      if (!cancelled) {
        setLoadedProfile({ userId, profile });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const profile = userId && loadedProfile?.userId === userId ? loadedProfile.profile : null;
  const isLoading = !isSessionRestored || (userId !== null && loadedProfile?.userId !== userId);

  const writeProfile = useCallback(
    async (updates: ProfileWrite): Promise<AuthResult> => {
      if (!userId) {
        return { error: 'You need to be signed in to do that.' };
      }
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single<Profile>();
      if (error) {
        return { error: "Couldn't save your details. Please try again." };
      }
      setLoadedProfile({ userId, profile: data });
      return { error: null };
    },
    [userId]
  );

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    if (!userId) {
      return null;
    }
    const nextProfile = await fetchProfile(userId);
    // Keep the last good copy if the refetch fails, rather than making the
    // rest of the app think there's no profile.
    if (nextProfile) {
      setLoadedProfile({ userId, profile: nextProfile });
    }
    return nextProfile;
  }, [userId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      hasCompletedOnboarding,
      completeOnboarding: () => setHasCompletedOnboarding(true),

      signUp: async ({ fullName, email, phone, password }) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // Read by the on_auth_user_created trigger to fill the profile row.
          options: { data: { full_name: fullName, phone } },
        });
        if (error) {
          return toAuthResult(error);
        }
        // With email confirmation on, Supabase doesn't error for an email
        // that's already registered and confirmed (so sign-up can't be used
        // to probe who has an account) — it returns a user with no
        // identities and sends nothing. That's the documented way to tell.
        if (data.user && data.user.identities?.length === 0) {
          return {
            error: FRIENDLY_AUTH_MESSAGES.user_already_exists,
            code: 'user_already_exists',
          };
        }
        // Only possible if "Confirm email" is ever turned off in Supabase:
        // the user is signed in immediately, no code to enter.
        if (data.session) {
          setSession(data.session);
          return { error: null, code: 'signed_in' };
        }
        return { error: null };
      },

      verifySignUpCode: async (email, code) => {
        const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
        if (error) {
          return toAuthResult(error);
        }
        // Also set directly (not only via onAuthStateChange) so the new
        // session is guaranteed to be in state before the caller navigates.
        setSession(data.session);
        return { error: null };
      },

      resendSignUpCode: async (email) => {
        const { error } = await supabase.auth.resend({ type: 'signup', email });
        return error ? toAuthResult(error) : { error: null };
      },

      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return toAuthResult(error);
        }
        setSession(data.session);
        return { error: null };
      },

      signOut: async () => {
        // 'local' = sign out this device only; other devices stay signed in.
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) {
          return toAuthResult(error);
        }
        setSession(null);
        return { error: null };
      },

      updateProfile: (updates) => writeProfile(updates),

      refreshProfile,

      requestPasswordReset: async (email) => {
        // Sends the "Reset password" email template, which must contain
        // {{ .Token }} for a code (the default sends a link).
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (!error) {
          return { error: null };
        }
        const result = toAuthResult(error);
        // Supabase already returns success for unknown emails. But its
        // per-address "wait 60 seconds" limit only applies to addresses that
        // DO have an account, so showing that error would reveal the email
        // is registered. Only a connection problem or a malformed address
        // (both of which say nothing about the account) are shown.
        if (result.code === 'network') {
          return result;
        }
        if (result.code === 'email_address_invalid' || result.code === 'validation_failed') {
          return { error: FRIENDLY_AUTH_MESSAGES.email_address_invalid, code: 'email_address_invalid' };
        }
        return { error: null };
      },

      verifyPasswordResetCode: async (email, code) => {
        const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
        if (error) {
          return toAuthResult(error);
        }
        setSession(data.session);
        return { error: null };
      },

      setNewPassword: async (password) => {
        // Supabase treats a session that came from a recovery code as a
        // recovery session, so no current password is needed here even with
        // "Require current password when updating" on.
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          if (error.name === 'AuthSessionMissingError') {
            return { error: SESSION_EXPIRED_MESSAGE, code: 'session_missing' };
          }
          return toAuthResult(error);
        }
        return { error: null };
      },

      changePassword: async (currentPassword, newPassword) => {
        const email = session?.user.email;
        if (!email) {
          return { error: SESSION_EXPIRED_MESSAGE, code: 'session_missing' };
        }

        // 1. Check the current password by signing in with it. A wrong
        //    password leaves the existing session untouched. This check runs
        //    in every case — Supabase's own server-side check (step 2) is
        //    skipped for sessions that came from an email code, such as
        //    right after sign-up.
        const check = await supabase.auth.signInWithPassword({ email, password: currentPassword });
        if (check.error) {
          if (check.error.code === 'invalid_credentials') {
            return { error: FRIENDLY_AUTH_MESSAGES.current_password_invalid, code: 'current_password_invalid' };
          }
          return toAuthResult(check.error);
        }
        setSession(check.data.session);

        // 2. Save it, passing current_password so Supabase re-checks it on
        //    the server too ("Require current password when updating"). The
        //    server then signs out every other session, keeping this one.
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
          current_password: currentPassword,
        });
        return error ? toAuthResult(error) : { error: null };
      },

      requestEmailChange: async (newEmail) => {
        // Sends the "Change email address" template (must contain
        // {{ .Token }}): to the new address, and with "Secure email change"
        // on, to the current address too, each with its own code.
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (!error) {
          return { error: null };
        }
        if (error.code === 'email_exists') {
          return { error: 'This email is already used by another account.', code: 'email_exists' };
        }
        if (error.code === 'validation_failed') {
          return { error: FRIENDLY_AUTH_MESSAGES.email_address_invalid, code: 'email_address_invalid' };
        }
        return toAuthResult(error);
      },

      verifyEmailChangeCode: async (email, code) => {
        // `email` must be the address the code was sent to: Supabase checks
        // each code against its own inbox's address.
        const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email_change' });
        if (error) {
          return toAuthResult(error);
        }
        if (!data.session) {
          // First of the two codes accepted; the other inbox's is still needed.
          return { error: null, complete: false };
        }
        setSession(data.session);
        return { error: null, complete: true };
      },

      resendEmailChangeCodes: async () => {
        // Supabase looks the user up by their CURRENT email here, not the
        // new one (with the new one it silently sends nothing).
        const currentEmail = session?.user.email;
        if (!currentEmail) {
          return { error: SESSION_EXPIRED_MESSAGE, code: 'session_missing' };
        }
        const { error } = await supabase.auth.resend({ type: 'email_change', email: currentEmail });
        return error ? toAuthResult(error) : { error: null };
      },
    }),
    [session, profile, isLoading, hasCompletedOnboarding, writeProfile, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
