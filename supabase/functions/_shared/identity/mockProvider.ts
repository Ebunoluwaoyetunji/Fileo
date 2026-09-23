/**
 * Fake provider for development and testing. No network calls.
 *
 * The result depends only on the last 4 digits, so every outcome can be
 * tested on purpose:
 *   ...0000 -> not_found
 *   ...1111 -> mismatch
 *   ...9999 -> error
 *   anything else -> verified, with a fake reference like "mock_<id>"
 *
 * The name is not checked. Any 11-digit number that doesn't end in one of
 * the codes above "passes", which is why this must never be the provider in
 * production (see index.ts).
 */
import type { IdentityProvider } from './types.ts';

export const mockProvider: IdentityProvider = {
  name: 'mock',

  verifyIdentity({ number }) {
    const lastFour = number.slice(-4);

    if (lastFour === '0000') {
      return Promise.resolve({ status: 'not_found', message: 'mock: test number for not_found' });
    }
    if (lastFour === '1111') {
      return Promise.resolve({ status: 'mismatch', message: 'mock: test number for mismatch' });
    }
    if (lastFour === '9999') {
      return Promise.resolve({ status: 'error', message: 'mock: test number for error' });
    }
    return Promise.resolve({
      status: 'verified',
      reference: `mock_${crypto.randomUUID()}`,
    });
  },
};
