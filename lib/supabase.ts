/**
 * The one Supabase client for the whole app.
 *
 * URL/key come from EXPO_PUBLIC_ env vars (see .env.example) — Expo inlines
 * these into the bundle at build time, so they must be read with plain
 * `process.env.EXPO_PUBLIC_…` dot access (not destructuring) to be picked up.
 *
 * Session persistence: on native, the session is stored in AsyncStorage so
 * users stay signed in across app restarts. On web, Supabase's own default
 * (localStorage in the browser) is used instead — AsyncStorage's web shim
 * touches `window` directly, which doesn't exist while `expo export`
 * statically renders pages in Node.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
      'in .env (copy .env.example), then restart the Expo dev server.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    // No OAuth/magic-link redirects in this app — sessions only come from
    // password sign-in and in-app OTP entry.
    detectSessionInUrl: false,
  },
});

// Native apps don't get the browser's visibility events, so tell the client
// when the app is foregrounded/backgrounded — it only needs to keep
// refreshing the session token while the app is actually in use.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
