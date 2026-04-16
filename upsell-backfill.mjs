// Upsell Backfill Script (SDK-free, uses REST API directly)
// Verteilt bestehende Paid-Kunden gestaffelt über X Tage (80/Tag)
// Default: Dry-Run — zeigt nur Verteilung, schreibt nix
// Mit --execute: schreibt tatsächlich in upsell_schedule

import fs from 'fs';

// Load .env.local manually
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) acc[k.trim()] = v.join('=').trim();
  return acc;
}, {});

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE;

const HEADERS = {
  'apikey': SUPABASE_SERVICE_ROLE,
  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

const EXECUTE = process.argv.includes('--execute');
const BATCH_SIZE = 80;
const START_IN_DAYS = 0;

async function fetchAll(table, select, filter = '', extraHeaders = {}) {
  const rows = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}${filter ? '&' + filter : ''}`;
    const res = await fetch(url, {
      headers: { ...HEADERS, 'Range': `${from}-${from + PAGE - 1}`, ...extraHeaders },
    });
    if (!res.ok) {
      throw new Error(`Fetch ${table} failed ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function run() {
  console.log(EXECUTE ? '🚀 EXECUTE MODE — writing to upsell_schedule' : '🔍 DRY-RUN MODE — no writes. Use --execute to apply.');
  console.log('');

  // 1. Fetch all paid leads
  console.log('Fetching paid leads...');
  const allLeads = await fetchAll(
    'wauwerk_leads',
    'id,email,paid_at,created_at',
    'status=in.(paid,plan_sent)&order=paid_at.asc.nullslast',
  );
  console.log(`  Paid leads: ${allLeads.length}`);

  // 2. Filter valid email
  const eligible = allLeads.filter(l => l.email && l.email.includes('@'));
  console.log(`  With valid email: ${eligible.length}`);

  // 3. Fetch existing schedule entries
  console.log('Fetching existing upsell_schedule entries...');
  const existing = await fetchAll('upsell_schedule', 'user_email');
  const existingEmails = new Set(existing.map(r => r.user_email));
  console.log(`  Already scheduled: ${existingEmails.size}`);

  const toSchedule = eligible.filter(l => !existingEmails.has(l.email));
  console.log(`  Not yet scheduled: ${toSchedule.length}`);
  console.log('');

  if (toSchedule.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  // 4. Stagger into batches
  const totalDays = Math.ceil(toSchedule.length / BATCH_SIZE);
  console.log(`Stagger plan: ${toSchedule.length} customers over ${totalDays} days (${BATCH_SIZE}/day)`);
  console.log('');

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const assignments = [];
  for (let i = 0; i < toSchedule.length; i++) {
    const dayOffset = Math.floor(i / BATCH_SIZE) + START_IN_DAYS;
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() + dayOffset);
    assignments.push({
      lead_id: toSchedule[i].id,
      user_email: toSchedule[i].email,
      upsell_start_date: startDate.toISOString().slice(0, 10),
      source: 'backfill',
    });
  }

  // 5. Preview distribution
  const dayCounts = {};
  assignments.forEach(a => { dayCounts[a.upsell_start_date] = (dayCounts[a.upsell_start_date] || 0) + 1; });
  const days = Object.keys(dayCounts).sort();
  console.log('Distribution:');
  days.slice(0, 5).forEach(d => console.log(`  ${d}: ${dayCounts[d]} customers`));
  if (days.length > 5) {
    console.log(`  ... (${days.length} days total)`);
    console.log(`  ${days[days.length - 1]}: ${dayCounts[days[days.length - 1]]} customers (last batch)`);
  }
  console.log('');

  const firstEmailDate = new Date(today);
  firstEmailDate.setUTCDate(firstEmailDate.getUTCDate() + START_IN_DAYS + 10);
  const lastBatchDate = days[days.length - 1];
  const lastEmailDate = new Date(lastBatchDate + 'T00:00:00Z');
  lastEmailDate.setUTCDate(lastEmailDate.getUTCDate() + 45);
  console.log(`First Ernährungs-Email:   ${firstEmailDate.toISOString().slice(0, 10)}`);
  console.log(`Last Erste-Hilfe-Email:   ${lastEmailDate.toISOString().slice(0, 10)}`);
  console.log('');

  if (!EXECUTE) {
    console.log('✋ DRY-RUN — no changes made. Re-run with --execute to apply.');
    return;
  }

  // 6. Bulk insert
  console.log('Writing to upsell_schedule...');
  let written = 0;
  for (let i = 0; i < assignments.length; i += 500) {
    const chunk = assignments.slice(i, i + 500);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/upsell_schedule`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.error(`Insert error at chunk ${i}:`, res.status, await res.text());
      return;
    }
    written += chunk.length;
    console.log(`  ${written} / ${assignments.length}`);
  }
  console.log(`✓ Done. ${written} customers scheduled.`);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
