// Baut aus allen email-samples/*.html eine einzige sortierte Übersicht
// (Vorschau + Copy-Feld pro Mail). Output: email-samples/_uebersicht.html
import { readFileSync, writeFileSync } from "node:fs";

const ORDER = [
  { key: "1-email-captured",   seg: "Segment 1 · email_captured (Interessent, kein Checkout)", n: "Mail 1 · sofort",              subj: "Balus Trainingsplan steht bereit – einmal reinschauen?" },
  { key: "seq-ec2-socialproof",seg: "Segment 1 · email_captured (Interessent, kein Checkout)", n: "Mail 2 · Tag 2",               subj: "Wie Rocky in 3 Wochen aufgehört hat zu ziehen" },
  { key: "seq-ec3-einwand",    seg: "Segment 1 · email_captured (Interessent, kein Checkout)", n: "Mail 3 · Tag 5",               subj: "Funktioniert das auch bei einem sturen Hund?" },
  { key: "2-pending-failed",   seg: "Segment 2 · pending/failed (Checkout abgebrochen)",       n: "Mail 1 · nach 1 Std",          subj: "Fast geschafft – Balus Plan wartet auf dich" },
  { key: "seq-p2-risiko",      seg: "Segment 2 · pending/failed (Checkout abgebrochen)",       n: "Mail 2 · nach 24 Std",         subj: "Kein Risiko für dich, Balus Plan ist abgesichert" },
  { key: "seq-p3-anstoss",     seg: "Segment 2 · pending/failed (Checkout abgebrochen)",       n: "Mail 3 · nach 48–72 Std",      subj: "Wir halten Balus Plan noch für dich bereit" },
  // Käufer-Mail-1 ("Willkommen") entfällt: Beim Kauf wird der Plan bereits per Mail ausgeliefert (triggerInternalPlanGeneration) — diese Plan-Mail IST der Willkommens-Touchpoint.
  { key: "seq-b2-aktivierung", seg: "Segment 3 · Käufer",                                      n: "Mail 1 · Tag 2 (nur wenn nicht eingeloggt)", subj: "Balu wartet auf Tag 1" },
  { key: "seq-b3-features",    seg: "Segment 3 · Käufer",                                      n: "Mail 2 · Tag 5",               subj: "Die zwei Funktionen, die den Unterschied machen" },
  { key: "seq-b4-bewertung",   seg: "Segment 3 · Käufer",                                      n: "Mail 3 · Tag 10",              subj: "Wie läuft's mit Balu?" },
];

const escText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

let toc = "", body = "", lastSeg = "";
for (let i = 0; i < ORDER.length; i++) {
  const m = ORDER[i];
  const raw = readFileSync(`email-samples/${m.key}.html`, "utf8");
  if (m.seg !== lastSeg) {
    body += `<h2 class="seg">${m.seg}</h2>`;
    toc += `<li class="toc-seg">${m.seg}</li>`;
    lastSeg = m.seg;
  }
  toc += `<li><a href="#${m.key}">${m.n} — ${m.subj}</a></li>`;
  body += `
  <section class="mail" id="${m.key}">
    <div class="mhead">
      <div><span class="badge">${m.n}</span> <span class="subj">${escText(m.subj)}</span></div>
      <button class="copy" onclick="cp('${m.key}', this)">HTML kopieren</button>
    </div>
    <div class="cols">
      <div class="col"><div class="lbl">Vorschau</div><iframe srcdoc="${escAttr(raw)}"></iframe></div>
      <div class="col"><div class="lbl">Quellcode</div><textarea id="t-${m.key}" readonly spellcheck="false">${escText(raw)}</textarea></div>
    </div>
  </section>`;
}

const out = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E-Mail-Sequenzen — Übersicht</title>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;background:#f4f4f5}
  .wrap{max-width:1100px;margin:0 auto;padding:24px 18px}
  h1{font-size:22px;margin:0 0 4px} .intro{color:#666;font-size:14px;margin:0 0 20px}
  .toc{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:14px 18px;margin:0 0 26px}
  .toc ul{margin:0;padding:0;list-style:none} .toc li{font-size:14px;padding:3px 0}
  .toc li.toc-seg{font-weight:800;margin-top:10px;color:#8B7355;text-transform:uppercase;font-size:11px;letter-spacing:.08em}
  .toc a{color:#1a5e2e;text-decoration:none} .toc a:hover{text-decoration:underline}
  h2.seg{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#8B7355;margin:34px 0 12px;border-bottom:2px solid #EADDC5;padding-bottom:6px}
  .mail{background:#fff;border:1px solid #e4e4e7;border-radius:12px;margin:0 0 18px;overflow:hidden}
  .mhead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#FAFAF8;border-bottom:1px solid #eee}
  .badge{display:inline-block;background:#C4A576;color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap}
  .subj{font-weight:700;font-size:14px}
  .copy{background:#1a1a1a;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
  .copy.ok{background:#15803d}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:0}
  @media(max-width:780px){.cols{grid-template-columns:1fr}}
  .col{padding:14px 16px} .col+.col{border-left:1px solid #eee}
  .lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:8px}
  iframe{width:100%;height:520px;border:1px solid #e4e4e7;border-radius:8px;background:#fff}
  textarea{width:100%;height:520px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.45;border:1px solid #e4e4e7;border-radius:8px;padding:10px;resize:vertical;background:#fbfbfa;color:#333}
</style></head>
<body><div class="wrap">
  <h1>E-Mail-Sequenzen — Übersicht</h1>
  <p class="intro">Alle 10 Mails sortiert nach Segment &amp; Reihenfolge. Links Vorschau, rechts der Quellcode zum Kopieren (Button oder ins Feld klicken &amp; Strg/Cmd+A → Strg/Cmd+C). Beispiel-Hund „Balu" (Mischling).</p>
  <div class="toc"><ul>${toc}</ul></div>
  ${body}
</div>
<script>
function cp(key, btn){
  var t=document.getElementById('t-'+key);
  t.select(); t.setSelectionRange(0,999999);
  navigator.clipboard.writeText(t.value).then(function(){
    var o=btn.textContent; btn.textContent='✓ kopiert'; btn.classList.add('ok');
    setTimeout(function(){btn.textContent=o; btn.classList.remove('ok');},1500);
  }).catch(function(){ document.execCommand('copy'); });
}
</script>
</body></html>`;

writeFileSync("email-samples/_uebersicht.html", out, "utf8");
console.log("✓ geschrieben: email-samples/_uebersicht.html (" + ORDER.length + " Mails)");
