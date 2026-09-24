/**
 * Picks the statement-reading provider from the AI_PROVIDER secret.
 *
 *   not set      -> mock
 *   "mock"       -> mockProvider.ts (fake results, no cost)
 *   "anthropic"  -> anthropicProvider.ts (needs ANTHROPIC_API_KEY; model
 *                   from AI_MODEL, default claude-sonnet-5)
 *
 * Any other value is a configuration mistake and throws, rather than
 * quietly falling back to the mock.
 */
import { anthropicProvider } from './anthropicProvider.ts';
import { mockProvider } from './mockProvider.ts';
import type { ExtractionProvider } from './types.ts';

export * from './types.ts';

const PROVIDERS: Record<string, ExtractionProvider> = {
  mock: mockProvider,
  anthropic: anthropicProvider,
};

export function getExtractionProvider(): ExtractionProvider {
  const configured = (Deno.env.get('AI_PROVIDER') ?? 'mock').trim().toLowerCase() || 'mock';
  const provider = PROVIDERS[configured];
  if (!provider) {
    throw new Error(
      `Unknown AI_PROVIDER "${configured}". Expected one of: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  return provider;
}
