// Pfoten-Plan Support-Chat — Widget im Assistenten-Stil (kein Framework).
// Floating-Button unten rechts (Marken-Braun) -> Mini-Chat: Quick-Fragen (sofort)
// + Eingabefeld (echte KI-Antwort via /api/support-chat). Mensch -> WhatsApp.
// Einbinden mit:  <script src="support-chat.js" defer></script>
(function () {
  if (window.__pfChat) return;
  window.__pfChat = true;

  var dog = "";
  try { dog = (localStorage.getItem("dogName") || "").trim(); } catch (e) {}
  var DOG = dog || "deinen Hund";
  function sess(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  var WA = "https://wa.me/4915129892586?text=" + encodeURIComponent("Hallo, ich habe eine Frage zu meinem Trainingsplan 🐾");

  // Quick-Fragen mit sofortiger (kostenloser) Antwort
  var FAQ = [
    { q: "Wann kommt mein Plan?", a: "Sofort nach dem Kauf per E-Mail — als PDF und mit Login zum Mitgliederbereich. Falls er nicht ankommt, schau bitte kurz im Spam-Ordner. 🐾" },
    { q: "Kann ich Antworten ändern?", a: "Ja klar! Sag mir einfach hier, was du ändern möchtest — z.B. das Hauptthema, das Alter oder die Rasse. Ich passe den Plan für " + DOG + " direkt an. 🐾" },
    { q: "So funktioniert's", a: "Du beantwortest ein kurzes Quiz zu deinem Hund, und wir erstellen daraus einen individuellen Schritt-für-Schritt-Plan. Kleine Übungen für jeden Tag, in deinem Tempo." },
    { q: "Ist das ein Abo?", a: "Nein, du zahlst einmalig. Kein Abo, keine Folgekosten." },
    { q: "Garantie & Geld zurück", a: "30 Tage Geld-zurück-Garantie. Wenn du nicht zufrieden bist, bekommst du dein Geld zurück — kein Risiko." },
  ];

  var css =
    "#pf-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#C4A576,#8B7355);box-shadow:0 6px 22px rgba(139,115,85,.45);display:flex;align-items:center;justify-content:center;transition:transform .15s}" +
    "#pf-btn:hover{transform:scale(1.06)}#pf-btn svg{width:28px;height:28px;fill:#fff}" +
    "#pf-badge{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;background:#E5484D;border-radius:9px;border:2px solid #fff;color:#fff;font:700 11px/15px -apple-system,Arial;text-align:center}" +
    "#pf-panel{position:fixed;right:18px;bottom:88px;z-index:2147483000;width:360px;max-width:calc(100vw - 28px);background:#fff;border-radius:20px;box-shadow:0 16px 48px rgba(0,0,0,.24);overflow:hidden;display:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}" +
    "#pf-panel.open{display:block;animation:pfIn .18s ease}@keyframes pfIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}" +
    ".pf-hd{background:linear-gradient(135deg,#C4A576,#8B7355);color:#fff;padding:15px 16px;display:flex;align-items:center;gap:11px}" +
    ".pf-av{position:relative;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}" +
    ".pf-av .dot{position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;background:#3BD671;border-radius:50%;border:2px solid #fff}" +
    ".pf-hd b{font-size:15px;display:block;line-height:1.2}.pf-hd small{font-size:12px;opacity:.9}" +
    ".pf-x{margin-left:auto;background:none;border:none;color:#fff;font-size:24px;cursor:pointer;line-height:1;opacity:.85}" +
    ".pf-note{font-size:12px;color:#8a8177;text-align:center;padding:11px 16px 4px;line-height:1.45}.pf-note a{color:#8B7355;font-weight:700}" +
    ".pf-body{padding:6px 14px 12px;max-height:46vh;overflow-y:auto;background:#FAF8F5}" +
    ".pf-bub{max-width:86%;padding:10px 13px;border-radius:15px;font-size:14px;line-height:1.5;margin-bottom:9px;white-space:pre-wrap}" +
    ".pf-ai{background:#fff;border:1px solid #EADDC5;color:#1a1a1a;border-bottom-left-radius:5px}" +
    ".pf-me{background:#8B7355;color:#fff;margin-left:auto;border-bottom-right-radius:5px}" +
    ".pf-chips{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 6px}" +
    ".pf-chip{background:#fff;border:1.5px solid #D9C7A6;color:#8B7355;font-weight:600;font-size:13px;padding:8px 13px;border-radius:999px;cursor:pointer}" +
    ".pf-chip:hover{background:#FFF9F0}" +
    ".pf-typing{display:inline-flex;gap:4px;padding:12px 14px}.pf-typing span{width:7px;height:7px;background:#C4A576;border-radius:50%;animation:pfB 1s infinite}.pf-typing span:nth-child(2){animation-delay:.15s}.pf-typing span:nth-child(3){animation-delay:.3s}@keyframes pfB{0%,60%,100%{opacity:.3}30%{opacity:1}}" +
    ".pf-inrow{display:flex;gap:8px;padding:10px 14px;border-top:1px solid #EFE7DA;background:#fff;align-items:center}" +
    ".pf-in{flex:1;border:1px solid #E0D3BC;border-radius:12px;padding:11px 13px;font-size:14px;outline:none;font-family:inherit}" +
    ".pf-in:focus{border-color:#C4A576}" +
    ".pf-send{background:linear-gradient(135deg,#C4A576,#8B7355);color:#fff;border:none;border-radius:12px;padding:11px 16px;font-weight:700;font-size:14px;cursor:pointer}" +
    ".pf-send:disabled{opacity:.5;cursor:default}";

  var style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  var wrap = document.createElement("div");
  wrap.innerHTML =
    '<button id="pf-btn" aria-label="Support-Chat öffnen">' +
    '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.2 1 4.2 2.7 5.7-.1 1-.5 2.4-1.4 3.3 1.5-.1 3-.6 4.2-1.5 1.4.5 2.9.8 4.5.8 5.5 0 10-3.8 10-8.6S17.5 3 12 3z"/></svg></button>' +
    '<div id="pf-panel" role="dialog" aria-label="Support-Chat">' +
    '<div class="pf-hd"><span class="pf-av">🐾<span class="dot"></span></span><div><b>Emma vom Pfoten-Plan Team</b><small>antwortet sofort</small></div><button class="pf-x" aria-label="Schließen">&times;</button></div>' +
    '<div class="pf-note">Du chattest mit unserer KI-Assistentin. Einen Menschen erreichst du per <a href="' + WA + '" target="_blank" rel="noopener">WhatsApp</a>.</div>' +
    '<div class="pf-body" id="pf-body"></div>' +
    '<div class="pf-inrow"><input class="pf-in" id="pf-in" type="text" placeholder="Deine Frage…" autocomplete="off"><button class="pf-send" id="pf-send">Senden</button></div>' +
    "</div>";
  document.body.appendChild(wrap);

  var btn = document.getElementById("pf-btn"), panel = document.getElementById("pf-panel");
  var bodyEl = document.getElementById("pf-body"), input = document.getElementById("pf-in"), sendBtn = document.getElementById("pf-send");
  var badge = document.getElementById("pf-badge");
  var history = []; // {role, content} für den KI-Kontext
  var seeded = false, busy = false;

  function bubble(text, who) {
    var d = document.createElement("div"); d.className = "pf-bub " + (who === "me" ? "pf-me" : "pf-ai");
    d.textContent = text; bodyEl.appendChild(d); bodyEl.scrollTop = bodyEl.scrollHeight; return d;
  }
  function chips() {
    var c = document.createElement("div"); c.className = "pf-chips";
    FAQ.forEach(function (f) {
      var b = document.createElement("button"); b.className = "pf-chip"; b.textContent = f.q;
      b.onclick = function () {
        bubble(f.q, "me"); history.push({ role: "user", content: f.q });
        setTimeout(function () { bubble(f.a, "ai"); history.push({ role: "assistant", content: f.a }); }, 300);
      };
      c.appendChild(b);
    });
    bodyEl.appendChild(c);
  }
  function typing() {
    var d = document.createElement("div"); d.className = "pf-bub pf-ai pf-typing";
    d.innerHTML = "<span></span><span></span><span></span>"; bodyEl.appendChild(d); bodyEl.scrollTop = bodyEl.scrollHeight; return d;
  }
  async function send() {
    var text = (input.value || "").trim(); if (!text || busy) return;
    busy = true; sendBtn.disabled = true; input.value = "";
    bubble(text, "me"); history.push({ role: "user", content: text });
    var t = typing();
    var t0 = Date.now();
    var reply;
    try {
      var r = await fetch("/api/support-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history, leadId: sess("leadId"), email: sess("email") || sess("wauwerk_email") || sess("userEmail") }) });
      var j = await r.json();
      reply = (j && j.reply) || "Schreib uns am besten kurz auf WhatsApp, dann helfen wir dir sofort. 🐾";
    } catch (e) {
      reply = "Oje, gerade hakt's. Schreib uns kurz auf WhatsApp, dann helfen wir dir sofort. 🐾";
    }
    // menschliches Tempo: "denken + tippen", skaliert mit Antwortlänge —
    // und IMMER ein sichtbarer Tipp-Beat nach dem Fetch, damit die Animation nie übersprungen wird
    var think = 1400 + Math.min(3000, (reply ? reply.length : 40) * 28); // ~1,6–4,4 s
    var waitMs = Math.max(1200, think - (Date.now() - t0));
    setTimeout(function () {
      t.remove(); bubble(reply, "ai"); history.push({ role: "assistant", content: reply });
      busy = false; sendBtn.disabled = false; input.focus();
    }, waitMs);
  }
  function open() {
    panel.classList.add("open"); if (badge) badge.style.display = "none";
    if (!seeded) { seeded = true; bubble("Hi! Ich bin Emma vom Pfoten-Plan Team. 🐾 Wenn du vor dem Kauf noch eine Frage hast, zur Lieferung, zu Änderungen oder zur Garantie, frag mich einfach.", "ai"); chips(); }
    setTimeout(function () { input.focus(); }, 100);
  }
  btn.onclick = function () { panel.classList.contains("open") ? panel.classList.remove("open") : open(); };
  wrap.querySelector(".pf-x").onclick = function () { panel.classList.remove("open"); };
  sendBtn.onclick = send;
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
})();
