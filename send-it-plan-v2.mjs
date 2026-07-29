// Robuster IT-Plan-Versand: liest den bereits composed Plan aus der DB,
// baut das IT-PDF isoliert (mit Logging + lokalem Backup), sendet dann via
// sendPlanReadyEmail(lang:"it") mit hartem Timeout. So ist sichtbar, ob der
// PDF-Bau oder der SMTP-Versand hängt.

import { readFileSync, writeFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const envMatches = [...envText.matchAll(/([A-Z_][A-Z0-9_]*)=([^\n\r]*?)(?=\s*[A-Z_][A-Z0-9_]*=|\s*$)/gm)];
for (const m of envMatches) {
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const EMAIL = "kontakt@primesocial.de";
const log = (...a) => { console.log(...a); };

const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT nach ${ms}ms: ${label}`)), ms)),
  ]);

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

log("→ Lese Plan aus DB...");
const { data: row, error } = await sb
  .from("member_plan_content")
  .select("content, dog_name, dog_breed")
  .ilike("email", EMAIL)
  .eq("plan_slug", "trainingsplan")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (error || !row) { console.error("Kein Plan in DB:", error); process.exit(1); }
const plan = row.content;
log(`  ✓ Plan geladen: ${plan.weeks?.length} Wochen`);

// ── Schritt 1: PDF isoliert bauen ──────────────────────────────────
log("→ Baue IT-PDF (buildPlanPdfFromContent lang=it)...");
const t0 = Date.now();
let pdfBytes;
try {
  const { buildPlanPdfFromContent } = await import("./lib/pdf-builder.ts");
  pdfBytes = await withTimeout(
    buildPlanPdfFromContent({
      plan,
      dogName: "Bruno",
      dogBreed: "Labrador (incrocio)",
      dogAge: "18 mesi",
      mainProblem: "tirare al guinzaglio",
      planLengthMonths: 3,
      lang: "it",
    }),
    60000,
    "PDF-Bau"
  );
  log(`  ✓ PDF gebaut: ${(pdfBytes.length / 1024).toFixed(0)} KB in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const backup = "/private/tmp/claude-501/-Users-maxxx-Documents-nextjs-boilerplate-main/fffd025e-952e-49fc-a94b-8da6d1993494/scratchpad/it-plan-bruno.pdf";
  writeFileSync(backup, pdfBytes);
  log(`  ✓ Lokales Backup: ${backup}`);
} catch (e) {
  console.error(`  ✗ PDF-Bau fehlgeschlagen/hängt: ${e.message}`);
  process.exit(1);
}

// ── Schritt 2: Versand via sendPlanReadyEmail (lang:it) mit Timeout ──
log("→ Sende Mail (sendPlanReadyEmail lang=it, via Google SMTP / Pfoten-Plan)...");
try {
  const { sendPlanReadyEmail } = await import("./lib/member-mail.ts");
  const res = await withTimeout(
    sendPlanReadyEmail({
      to: EMAIL,
      dogName: "Bruno",
      dogBreed: "Labrador (incrocio)",
      dogAge: "18 mesi",
      mainProblem: "tirare al guinzaglio",
      planLengthMonths: 3,
      plan,
      customerName: "Max",
      lang: "it",
    }),
    45000,
    "Mail-Versand"
  );
  log(`  ${res.ok ? "✓" : "✗"} Versand: ok=${res.ok}${res.reason ? " reason=" + res.reason : ""}${res.via ? " via=" + res.via : ""}`);
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  console.error(`  ✗ Versand fehlgeschlagen/hängt: ${e.message}`);
  console.error("  → PDF liegt aber als lokales Backup vor (siehe oben).");
  process.exit(1);
}
