/**
 * Fingerprint / Face ID confirmation for sensitive account changes
 * (currently: changing the email on Edit Profile).
 *
 * Biometrics only — the device PIN / pattern / passcode is never offered
 * (disableDeviceFallback), because someone holding an unlocked phone may
 * know it. When biometrics can't be used, the caller falls back to the
 * user's Fileo password instead.
 *
 * Web and devices without enrolled biometrics report 'unavailable'.
 */
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * - success: the user passed the fingerprint / face check.
 * - cancelled: the user (or the system) dismissed the prompt; do nothing.
 * - use_password: too many failed attempts, "Use password instead" (iOS),
 *   or an unexpected error; ask for the Fileo password.
 * - unavailable: no biometric hardware, or nothing enrolled.
 */
export type BiometricResult = 'success' | 'cancelled' | 'use_password' | 'unavailable';

/** True when the device has biometric hardware with a fingerprint / face enrolled. */
export async function canUseBiometrics(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function confirmWithBiometrics(promptMessage: string): Promise<BiometricResult> {
  let result: LocalAuthentication.LocalAuthenticationResult;
  try {
    result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      // iOS shows this after a failed scan; Android has no equivalent, so
      // Edit Profile has its own "Use password instead" link.
      fallbackLabel: 'Use password instead',
      disableDeviceFallback: true,
    });
  } catch {
    return 'use_password';
  }
  if (result.success) {
    return 'success';
  }
  switch (result.error) {
    // On Android the prompt's Cancel button, back, and tapping outside all
    // report user_cancel.
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
      return 'cancelled';
    case 'not_enrolled':
    case 'not_available':
    case 'passcode_not_set':
      return 'unavailable';
    // user_fallback (iOS "Use password instead"), lockout and
    // authentication_failed (too many failed attempts), and anything else.
    default:
      return 'use_password';
  }
}
