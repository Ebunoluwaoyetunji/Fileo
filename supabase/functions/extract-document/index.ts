/**
 * extract-document — reads one uploaded statement with AI and suggests the
 * income in it. The user always reviews and confirms; this never changes
 * their return by itself.
 *
 * POST { document_id: "<uuid>" }
 *
 * Checks, in order:
 *   1. a signed-in user                                   401 unauthorized
 *   2. they've allowed AI reading (profiles.ai_consent_at) 403 consent_required
 *   3. the document is theirs                              404 not_found
 *   4. it's a statement: a bank statement, or the document in one of their
 *      returns' platform slots (never a deduction receipt)  422 not_a_statement
 *   5. already read (done / unreadable) or being read now: that result is
 *      returned; the same file is never paid for twice    200
 *   6. at most MAX_EXTRACTIONS_PER_DAY paid reads per user
 *      in 24 hours                                        429 rate_limited
 * Then the read starts in the background and the reply is
 *   202 { status: 'processing' }
 * The app watches the document_extractions row (it can read its own) for the
 * result: done (with warnings), failed (can try again) or unreadable.
 *
 * In the background: download the file from storage (server side), check it
 * (type, size, password, page count), ask the provider for structured
 * output, validate it strictly, run the sanity checks, then save the
 * transactions and let the database work out the suggested income.
 *
 * Logs never contain document contents, file names, amounts, descriptions
 * or keys — only ids, statuses and error codes.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { checkFile } from '../_shared/extraction/fileChecks.ts';
import {
  ExtractionError,
  type ExtractionProvider,
  getExtractionProvider,
} from '../_shared/extraction/index.ts';
import { buildExtraction, validateRawExtraction } from '../_shared/extraction/validate.ts';

/** Paid reads allowed per user per 24 hours. Change here to raise or lower it. */
export const MAX_EXTRACTIONS_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A read still "processing" after this long is treated as abandoned (the
 * function was stopped) and may be started again. */
const STALE_PROCESSING_MS = 5 * 60 * 1000;
const DOCUMENTS_BUCKET = 'documents';

type ReplyStatus =
  | 'processing'
  | 'done'
  | 'unreadable'
  | 'failed'
  | 'invalid_request'
  | 'unauthorized'
  | 'consent_required'
  | 'not_found'
  | 'not_a_statement'
  | 'rate_limited'
  | 'error';

const MESSAGES: Partial<Record<ReplyStatus, string>> = {
  unauthorized: 'Please sign in again.',
  consent_required: 'Allow Fileo to read your statements first, or type your income yourself.',
  not_found: 'We couldn’t find that document.',
  not_a_statement: 'Only bank and platform statements can be read automatically.',
  rate_limited: `You’ve reached today’s limit of ${MAX_EXTRACTIONS_PER_DAY} statements. You can type your income yourself, or try again tomorrow.`,
  error: 'Something went wrong. You can type your income yourself.',
};

function reply(httpStatus: number, status: ReplyStatus, extra: Record<string, unknown> = {}) {
  return Response.json(
    { status, message: MESSAGES[status] ?? null, ...extra },
    { status: httpStatus, headers: corsHeaders }
  );
}

/** Same resolution as verify-identity: new-style secret keys, else legacy. */
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
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Keeps the read going after the reply has been sent. On Supabase this is
 * EdgeRuntime.waitUntil; when run locally with plain Deno the server stays
 * up anyway. */
function runInBackground(task: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(task);
  } else {
    task.catch(() => {});
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DocumentRow = {
  id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  category: string;
  tax_year: number;
};

type ExistingRow = {
  id: string;
  status: string;
  started_at: string | null;
};

type ExtractionRow = {
  id: string;
  input_tokens: number | null;
  output_tokens: number | null;
};

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return reply(405, 'invalid_request');
  }
  const admin = createAdminClient();
  if (!admin) {
    console.error('extract-document: SUPABASE_URL or the secret key is not available');
    return reply(500, 'error');
  }

  // 1. Signed-in user.
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return reply(401, 'unauthorized');
  }
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return reply(401, 'unauthorized');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, 'invalid_request');
  }
  const documentId = (body as { document_id?: unknown } | null)?.document_id;
  if (typeof documentId !== 'string' || !UUID.test(documentId)) {
    return reply(400, 'invalid_request');
  }

  // 2. Consent.
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('ai_consent_at')
    .eq('id', user.id)
    .maybeSingle<{ ai_consent_at: string | null }>();
  if (profileError) {
    console.error('extract-document: could not load profile', profileError.code);
    return reply(500, 'error');
  }
  if (!profile?.ai_consent_at) {
    return reply(403, 'consent_required');
  }

  // 3. Their document.
  const { data: document, error: documentError } = await admin
    .from('documents')
    .select('id, user_id, storage_path, file_name, mime_type, category, tax_year')
    .eq('id', documentId)
    .maybeSingle<DocumentRow>();
  if (documentError) {
    console.error('extract-document: could not load document', documentError.code);
    return reply(500, 'error');
  }
  if (!document || document.user_id !== user.id) {
    return reply(404, 'not_found');
  }

  // 4. A statement, not a receipt.
  if (document.category !== 'bank_statement') {
    const { data: slots, error: slotError } = await admin
      .from('filing_documents')
      .select('slot, filings!inner(user_id)')
      .eq('document_id', document.id)
      .eq('filings.user_id', user.id)
      .like('slot', 'platform:%')
      .limit(1);
    if (slotError) {
      console.error('extract-document: could not check slots', slotError.code);
      return reply(500, 'error');
    }
    if (!slots || slots.length === 0) {
      return reply(422, 'not_a_statement');
    }
  }

  // 5. Already read, or being read.
  const { data: existing, error: existingError } = await admin
    .from('document_extractions')
    .select('id, status, started_at')
    .eq('document_id', document.id)
    .maybeSingle<ExistingRow>();
  if (existingError) {
    console.error('extract-document: could not load extraction', existingError.code);
    return reply(500, 'error');
  }
  const isFresh = (row: ExistingRow) =>
    row.started_at !== null && Date.now() - new Date(row.started_at).getTime() < STALE_PROCESSING_MS;
  if (existing) {
    if (existing.status === 'done' || existing.status === 'unreadable') {
      return reply(200, existing.status, { extraction_id: existing.id });
    }
    if ((existing.status === 'processing' || existing.status === 'pending') && isFresh(existing)) {
      return reply(200, 'processing', { extraction_id: existing.id });
    }
    // failed, or abandoned: read it again below.
  }

  // 6. Daily limit. If the count can't be read, refuse rather than risk
  //    unlimited paid reads.
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count, error: countError } = await admin
    .from('document_extraction_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if (countError || count === null) {
    console.error('extract-document: could not count attempts', countError?.code);
    return reply(500, 'error');
  }
  if (count >= MAX_EXTRACTIONS_PER_DAY) {
    return reply(429, 'rate_limited');
  }

  let provider: ExtractionProvider;
  try {
    provider = getExtractionProvider();
  } catch (error) {
    console.error('extract-document:', error instanceof Error ? error.message : 'bad AI_PROVIDER');
    return reply(500, 'error');
  }

  // Claim the document in one step in the database: creates the extraction,
  // or restarts a failed / abandoned one. A read already under way (or
  // finished) can't be claimed, so two requests can't both pay for a read.
  const { data: claimedRows, error: claimError } = await admin.rpc('claim_document_extraction', {
    p_document_id: document.id,
    p_user_id: user.id,
    p_provider: provider.name,
    p_model: provider.model(),
    p_stale_seconds: STALE_PROCESSING_MS / 1000,
  });
  if (claimError) {
    console.error('extract-document: could not claim document', claimError.code);
    return reply(500, 'error');
  }
  const claimed = ((claimedRows ?? []) as ExtractionRow[])[0];
  if (!claimed) {
    // Someone else started it a moment ago.
    return reply(200, 'processing');
  }

  runInBackground(runExtraction(admin, provider, document, claimed));
  return reply(202, 'processing', { extraction_id: claimed.id });
}

/** The read itself. Always ends with the row in done, failed or unreadable. */
async function runExtraction(
  admin: SupabaseClient,
  provider: ExtractionProvider,
  document: DocumentRow,
  extraction: ExtractionRow
) {
  const extractionId = extraction.id;
  let attemptId: string | null = null;
  let tokens = { input: extraction.input_tokens ?? 0, output: extraction.output_tokens ?? 0 };
  const addTokens = async (input: number | null, output: number | null) => {
    if (input === null && output === null) {
      return;
    }
    tokens = { input: tokens.input + (input ?? 0), output: tokens.output + (output ?? 0) };
    await admin
      .from('document_extractions')
      .update({ input_tokens: tokens.input, output_tokens: tokens.output })
      .eq('id', extractionId);
    if (attemptId) {
      await admin
        .from('document_extraction_attempts')
        .update({ input_tokens: input, output_tokens: output })
        .eq('id', attemptId);
    }
  };
  const finish = async (fields: Record<string, unknown>, outcome: string) => {
    const { error } = await admin
      .from('document_extractions')
      .update({ ...fields, completed_at: new Date().toISOString() })
      .eq('id', extractionId);
    if (error) {
      console.error('extract-document: could not save result', extractionId, error.code);
    }
    if (attemptId) {
      await admin.from('document_extraction_attempts').update({ outcome }).eq('id', attemptId);
    }
    console.log(`extract-document: ${extractionId} ${outcome} (provider ${provider.name})`);
  };

  try {
    // Download on the server; the file never goes back through the app.
    const { data: blob, error: downloadError } = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .download(document.storage_path);
    if (downloadError || !blob) {
      throw new ExtractionError('download_failed', 'storage download failed');
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const checked = await checkFile(bytes, document.mime_type);
    await admin.from('document_extractions').update({ page_count: checked.pageCount }).eq('id', extractionId);

    // Count the paid attempt before paying, so the daily limit holds even
    // if this function is stopped part-way.
    const { data: attempt, error: attemptError } = await admin
      .from('document_extraction_attempts')
      .insert({
        user_id: document.user_id,
        document_id: document.id,
        provider: provider.name,
        model: provider.model(),
        outcome: 'started',
      })
      .select('id')
      .single<{ id: string }>();
    if (attemptError || !attempt) {
      throw new ExtractionError('internal', `could not log attempt ${attemptError?.code ?? ''}`);
    }
    attemptId = attempt.id;

    const result = await provider.extract({
      file: bytes,
      mimeType: checked.mimeType,
      taxYear: document.tax_year,
      fileName: document.file_name,
    });
    await addTokens(result.inputTokens, result.outputTokens);

    const raw = validateRawExtraction(result.output);
    const built = buildExtraction(raw, document.tax_year);
    if (built.kind === 'unreadable') {
      await finish({ status: 'unreadable', error_code: built.code, model: result.model }, built.code);
      return;
    }

    // Replace any transactions from an earlier, failed try.
    await admin.from('extracted_transactions').delete().eq('extraction_id', extractionId);
    if (built.transactions.length > 0) {
      const { error: insertError } = await admin.from('extracted_transactions').insert(
        built.transactions.map((t) => ({ ...t, extraction_id: extractionId, user_id: document.user_id }))
      );
      if (insertError) {
        throw new ExtractionError('internal', `could not save transactions ${insertError.code}`);
      }
    }
    // Save what was read, then let the database work out the suggestion
    // (income + flagged items marked as income, in the tax year, naira
    // only) before marking the read done, so the app never sees 'done'
    // without its suggestion. The database copies it to the return.
    const { error: saveError } = await admin
      .from('document_extractions')
      .update({
        model: result.model,
        period_start: built.periodStart,
        period_end: built.periodEnd,
        currency: built.currency,
        total_inflows_kobo: built.totalInflowsKobo,
        warnings: built.warnings,
      })
      .eq('id', extractionId);
    if (saveError) {
      throw new ExtractionError('internal', `could not save result ${saveError.code}`);
    }
    // Categories against the filing's platforms (payouts already counted
    // under another platform), then the suggestion.
    const { error: suggestionError } = await admin.rpc('recategorize_extraction', {
      p_extraction_id: extractionId,
    });
    if (suggestionError) {
      throw new ExtractionError('internal', `could not work out suggestion ${suggestionError.code}`);
    }
    await finish({ status: 'done', error_code: null }, 'done');
  } catch (error) {
    const failure =
      error instanceof ExtractionError ? error : new ExtractionError('internal', 'unexpected error');
    if (!(error instanceof ExtractionError)) {
      console.error('extract-document: unexpected error', error instanceof Error ? error.name : 'unknown');
    } else if (failure.status === 'failed') {
      console.error(`extract-document: ${extractionId} ${failure.code}: ${failure.message}`);
    }
    await addTokens(failure.inputTokens, failure.outputTokens);
    await admin.from('extracted_transactions').delete().eq('extraction_id', extractionId);
    await finish({ status: failure.status, error_code: failure.code, suggested_income_kobo: null }, failure.code);
  }
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (error) {
    console.error('extract-document: unexpected error', error instanceof Error ? error.name : 'unknown');
    return reply(500, 'error');
  }
});
