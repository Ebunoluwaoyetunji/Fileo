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
};

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
