/**
 * Email-change code entry, reached from Edit Profile. Renders the shared
 * OTP Verification screen (purpose=email_change) — this file only exists
 * so the step sits in the signed-in (app) stack, behind its auth guard, and
 * "back"/finishing returns to Profile.
 */
export { default } from '../(auth)/otp-verification';
