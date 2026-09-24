/**
 * Anthropic provider: real calls to the Messages API with the statement as
 * a PDF document block or an image block, and structured output
 * (output_config.format with a JSON schema), so the reply is JSON matching
 * EXTRACTION_SCHEMA rather than free text. The Edge Function still
 * validates it strictly before saving anything.
 *
 * Secrets (Supabase → Edge Functions → Secrets; never in the app or repo):
 *   AI_PROVIDER=anthropic      selects this provider
 *   ANTHROPIC_API_KEY          your key
 *   AI_MODEL                   optional; default claude-sonnet-5.
 *                              claude-haiku-4-5 is cheaper (100-page PDF
 *                              limit, no effort setting).
 *
 * Limits we rely on (Anthropic docs, checked when this was written):
 *   - PDFs: standard PDFs only (no passwords/encryption), 32 MB per request,
 *     up to 600 pages (100 on 200k-context models such as Haiku 4.5). We
 *     cap far lower (fileChecks.ts MAX_PDF_PAGES).
 *   - Images: JPEG, PNG, GIF, WebP; up to 10 MB base64 each. No HEIC.
 *   - Each PDF page is sent as text plus an image: roughly 1,500–3,000 text
 *     tokens plus the image tokens per page.
 *
 * Nothing from the document, and no part of the key, is ever logged.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.128.0';
import { EXTRACTION_SCHEMA, SYSTEM_PROMPT, userInstruction } from './schema.ts';
import { ExtractionError, type ExtractionProvider } from './types.ts';

export const DEFAULT_MODEL = 'claude-sonnet-5';
/** Enough room for a few hundred transactions. */
const MAX_OUTPUT_TOKENS = 16000;
/** Stay inside the Edge Function's time limit (150 s on the free plan). */
const REQUEST_TIMEOUT_MS = 110_000;

function configuredModel(): string {
  return (Deno.env.get('AI_MODEL') ?? '').trim() || DEFAULT_MODEL;
}

/** Base64 without building one huge string of characters first. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const anthropicProvider: ExtractionProvider = {
  name: 'anthropic',

  model() {
    return configuredModel();
  },

  async extract({ file, mimeType, taxYear }) {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new ExtractionError('config_error', 'ANTHROPIC_API_KEY is not set');
    }
    const model = configuredModel();
    const client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });

    const data = toBase64(file);
    const fileBlock: Anthropic.ContentBlockParam =
      mimeType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
        : { type: 'image', source: { type: 'base64', media_type: mimeType, data } };

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            // File first, then the instruction (Anthropic's recommended order).
            content: [fileBlock, { type: 'text', text: userInstruction(taxYear) }],
          },
        ],
        output_config: {
          format: { type: 'json_schema', schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown> },
          // Haiku 4.5 doesn't take an effort setting; newer models do.
          ...(model.startsWith('claude-haiku') ? {} : { effort: 'medium' as const }),
        },
      });
    } catch (error) {
      // Most specific first. Only the class and status are logged by the
      // caller — never the message body.
      if (error instanceof Anthropic.APIConnectionTimeoutError) {
        throw new ExtractionError('timeout', 'anthropic: request timed out');
      }
      if (error instanceof Anthropic.APIConnectionError) {
        throw new ExtractionError('provider_unavailable', 'anthropic: connection error');
      }
      if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
        throw new ExtractionError('provider_unavailable', `anthropic: status ${error.status}`);
      }
      if (error instanceof Anthropic.APIError) {
        // 400 (e.g. a PDF it can't open), 401/403 (key), 404 (model name).
        throw new ExtractionError('config_error', `anthropic: status ${error.status}`);
      }
      throw new ExtractionError('internal', 'anthropic: unexpected error');
    }

    const usage = {
      inputTokens:
        response.usage.input_tokens +
        (response.usage.cache_creation_input_tokens ?? 0) +
        (response.usage.cache_read_input_tokens ?? 0),
      outputTokens: response.usage.output_tokens,
    };
    if (response.stop_reason === 'refusal') {
      throw new ExtractionError('refused', 'anthropic: refusal', usage);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new ExtractionError('too_long', 'anthropic: output hit max_tokens', usage);
    }
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    let output: unknown;
    try {
      output = JSON.parse(text);
    } catch {
      throw new ExtractionError('invalid_output', 'anthropic: reply was not JSON', usage);
    }
    return { output, model: response.model ?? model, ...usage };
  },
};
