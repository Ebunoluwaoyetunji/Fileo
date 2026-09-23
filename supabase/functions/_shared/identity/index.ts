/**
 * Picks the identity provider from the IDENTITY_PROVIDER secret.
 *
 *   not set  -> mock
 *   "mock"   -> mockProvider.ts
 *   "dojah"  -> dojahProvider.ts
 *
 * Any other value is treated as a configuration mistake and throws, rather
 * than quietly falling back to the mock (which would pass everyone).
 */
import { dojahProvider } from './dojahProvider.ts';
import { mockProvider } from './mockProvider.ts';
import type { IdentityProvider } from './types.ts';

export type { IdentityCheckStatus, IdentityCheckType, IdentityProvider } from './types.ts';

const PROVIDERS: Record<string, IdentityProvider> = {
  mock: mockProvider,
  dojah: dojahProvider,
};

export function getIdentityProvider(): IdentityProvider {
  const configured = (Deno.env.get('IDENTITY_PROVIDER') ?? 'mock').trim().toLowerCase() || 'mock';
  const provider = PROVIDERS[configured];
  if (!provider) {
    throw new Error(
      `Unknown IDENTITY_PROVIDER "${configured}". Expected one of: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  return provider;
}
