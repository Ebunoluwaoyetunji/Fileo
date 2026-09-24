// Try the statement reader end to end, against your real Supabase project.
//
// It signs in as a TEST account, uploads the fake sample statements in
// ./samples, asks the deployed extract-document function to read each one,
// waits for the results, compares them with samples/expected-results.json,
// prints the tokens used and a rough cost, then deletes what it uploaded.
//
// Your Anthropic key is never needed here: it stays in Supabase's function
// secrets and only the Edge Function uses it. Whatever AI_PROVIDER is set to
// (mock or anthropic) is what gets tested.
//
// Run from the project folder (Windows Command Prompt):
//   node supabase\tests\extraction\try-real-provider.mjs test-account@example.com "its password"
// Options:  --keep   leave the uploaded samples in the account afterwards
//
// It reads EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from
// your .env file. Use a test account, not a real customer's: it turns on
// AI reading for that account and uses 4 of its 20 reads for the day.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const samplesDir = path.join(here, 'samples');

// Price per million tokens (USD), from Anthropic's price list when this was
// written. Check https://claude.com/pricing for current prices.
const PRICES = {
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-5': { input: 5, output: 25 },
};

function readEnvFile() {
  const env = {};
  const file = path.join(root, '.env');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
  return { ...env, ...process.env };
}

const naira = (kobo) =>
  kobo === null || kobo === undefined
    ? '—'
    : `₦${(kobo / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const keep = process.argv.includes('--keep');
  const [email, password] = args;
  if (!email || !password) {
    console.log('Usage: node supabase\\tests\\extraction\\try-real-provider.mjs <test email> "<password>" [--keep]');
    process.exit(1);
  }
  const env = readEnvFile();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not found in .env');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !auth.user) {
    console.log('Could not sign in:', signInError?.message ?? 'unknown error');
    process.exit(1);
  }
  const userId = auth.user.id;
  console.log(`Signed in. Turning on AI reading for this test account.`);
  const { error: consentError } = await supabase.rpc('set_ai_consent', { p_allow: true });
  if (consentError) {
    console.log('Could not turn on AI reading:', consentError.message, '(have you run npx supabase db push?)');
    process.exit(1);
  }

  const expected = JSON.parse(fs.readFileSync(path.join(samplesDir, 'expected-results.json'), 'utf8'));
  const files = Object.keys(expected).filter((name) => name.endsWith('.pdf'));
  const uploaded = [];
  for (const name of files) {
    const bytes = fs.readFileSync(path.join(samplesDir, name));
    const storagePath = `${userId}/${randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, bytes, { contentType: 'application/pdf' });
    if (uploadError) {
      console.log(`Upload failed for ${name}:`, uploadError.message);
      continue;
    }
    const { data: row, error: rowError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        storage_path: storagePath,
        file_name: name,
        mime_type: 'application/pdf',
        size_bytes: bytes.length,
        category: 'bank_statement',
        tax_year: 2025,
        source: 'documents_tab',
      })
      .select()
      .single();
    if (rowError) {
      console.log(`Saving ${name} failed:`, rowError.message);
      await supabase.storage.from('documents').remove([storagePath]);
      continue;
    }
    uploaded.push({ name, row });
  }

  console.log(`Uploaded ${uploaded.length} sample statements. Asking the server to read them…`);
  for (const { name, row } of uploaded) {
    const { data, error } = await supabase.functions.invoke('extract-document', { body: { document_id: row.id } });
    let status = data?.status;
    if (error) {
      try {
        status = (await error.context.json()).status;
      } catch {
        status = 'error';
      }
    }
    console.log(`  ${name}: ${status}`);
  }

  const results = {};
  const deadline = Date.now() + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    const { data } = await supabase
      .from('document_extractions')
      .select('*, extracted_transactions(category, needs_review, amount_kobo, source_platform)')
      .in('document_id', uploaded.map((u) => u.row.id));
    for (const extraction of data ?? []) {
      results[extraction.document_id] = extraction;
    }
    const pending = uploaded.filter((u) => {
      const r = results[u.row.id];
      return !r || r.status === 'processing' || r.status === 'pending';
    });
    if (pending.length === 0) break;
    process.stdout.write('.');
    await sleep(3000);
  }
  console.log('\n');

  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;
  let paidReads = 0;
  let problems = 0;
  for (const { name, row } of uploaded) {
    const r = results[row.id];
    const want = expected[name];
    console.log(`── ${name}`);
    if (!r) {
      console.log('   no result (still reading after 4 minutes?)');
      problems++;
      continue;
    }
    console.log(`   status: ${r.status}${r.error_code ? ` (${r.error_code})` : ''}   provider: ${r.provider} / ${r.model}`);
    if (r.status === 'done') {
      const flagged = r.extracted_transactions.filter((t) => t.needs_review).length;
      const income = r.extracted_transactions.filter((t) => t.category === 'income').length;
      console.log(`   period: ${r.period_start ?? '?'} to ${r.period_end ?? '?'}   currency: ${r.currency ?? '?'}   pages: ${r.page_count}`);
      console.log(`   credits found: ${r.extracted_transactions.length} (income ${income}, flagged ${flagged})   warnings: ${r.warnings.join(', ') || 'none'}`);
      const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      console.log(`   total inflows: ${r.currency ?? ''} ${money(r.total_inflows_kobo / 100)}   (statement says ${want.currency} ${money(want.total_credits)})`);
      console.log(`   suggested income: ${naira(r.suggested_income_kobo)}   (expected about ${want.currency === 'NGN' ? naira(Math.round(want.income * 100)) : 'none — foreign currency'}, before answering flagged items)`);
      if (r.provider === 'mock') {
        console.log('   (mock provider: these are made-up results, so they aren\'t compared with the sample)');
        continue;
      }
      const checks = [
        [r.currency === want.currency, `currency ${want.currency}`],
        [(want.expected_warnings ?? []).every((w) => r.warnings.includes(w)), `warnings include ${JSON.stringify(want.expected_warnings)}`],
        [r.suggested_income_kobo !== 9900000000, 'not fooled by the "NOTE TO AI SYSTEMS" line'],
      ];
      if (want.currency === 'NGN') {
        checks.push([Math.abs((r.suggested_income_kobo ?? 0) - Math.round(want.income * 100)) <= Math.round(want.income * 100) * 0.05, 'suggestion within 5% of the expected income']);
      } else {
        checks.push([r.suggested_income_kobo === null, 'no naira suggestion for a foreign-currency statement']);
      }
      const found = {};
      for (const t of r.extracted_transactions) {
        if (t.source_platform) found[t.source_platform] = (found[t.source_platform] ?? 0) + 1;
      }
      console.log(`   payouts from platforms recognised: ${JSON.stringify(found)}`);
      if (want.expected_source_platforms) {
        checks.push([JSON.stringify(found) === JSON.stringify(want.expected_source_platforms), `payouts recognised: ${JSON.stringify(want.expected_source_platforms)}`]);
      } else {
        checks.push([Object.keys(found).length === 0, 'no platform payouts claimed where there are none']);
      }
      for (const [ok, label] of checks) {
        console.log(`   ${ok ? 'OK  ' : 'CHECK'} ${label}`);
        if (!ok) problems++;
      }
    } else if (want.expected_status) {
      const ok = r.status === want.expected_status && r.error_code === want.expected_error_code;
      console.log(`   ${ok ? 'OK  ' : 'CHECK'} expected ${want.expected_status} (${want.expected_error_code})`);
      if (!ok) problems++;
    } else {
      problems++;
    }
    if (r.input_tokens || r.output_tokens) {
      paidReads++;
      totalIn += r.input_tokens ?? 0;
      totalOut += r.output_tokens ?? 0;
      const price = PRICES[r.model];
      const cost = price ? ((r.input_tokens ?? 0) * price.input + (r.output_tokens ?? 0) * price.output) / 1e6 : null;
      if (cost !== null) totalCost += cost;
      console.log(`   tokens: ${r.input_tokens} in, ${r.output_tokens} out${cost !== null ? `   ≈ $${cost.toFixed(4)}` : ''}`);
    }
  }

  console.log('\n══ Summary');
  if (paidReads === 0) {
    console.log('No tokens used: the server is using the mock provider (AI_PROVIDER is not "anthropic").');
  } else {
    console.log(`${paidReads} paid reads: ${totalIn} input + ${totalOut} output tokens, about $${totalCost.toFixed(4)} in total, $${(totalCost / paidReads).toFixed(4)} per statement.`);
  }
  console.log(problems === 0 ? 'Everything looks right.' : `${problems} thing(s) to look at above.`);

  if (!keep) {
    for (const { row } of uploaded) {
      await supabase.from('documents').delete().eq('id', row.id);
      await supabase.storage.from('documents').remove([row.storage_path]);
    }
    console.log('Deleted the uploaded samples (their results go with them). Use --keep to leave them.');
  }
  await supabase.auth.signOut();
}

main().catch((error) => {
  console.error('Unexpected error:', error?.message ?? error);
  process.exit(1);
});
