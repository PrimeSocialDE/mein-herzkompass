// ==================== PFOTEN-PLAN UTM & ATTRIBUTION v3.0 ====================
// FIRST-TOUCH-ATTRIBUTION:
// Erfasst die Herkunft beim ERSTEN Aufruf mit echtem Signal (utm / Click-ID /
// In-App-Browser), speichert sie persistent im Cookie `pp_attr`
// (.pfoten-plan.de, 90 Tage, SameSite=Lax) + localStorage und ÜBERSCHREIBT SIE
// NIE. Ein späterer organischer Besuch kann die Ad-Herkunft also nicht löschen.
//
// WICHTIG für den CRM-Join:
//  • Werte werden 1:1 (URL-decoded) gespeichert und NICHT gekürzt — utm_content
//    wird gegen den Meta-Anzeigennamen gematcht.
//  • Der Checkout liest die Herkunft serverseitig aus dem `pp_attr`-Cookie
//    (maßgeblich), nicht aus der aktuellen URL → garantiert First-Touch.
(function () {
  var ATTR_KEY = "pp_attr";
  var MAX_AGE = 90 * 24 * 60 * 60; // Sekunden

  function getCookie(name) {
    var m = document.cookie.match("(?:^|; )" + name + "=([^;]*)");
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value) {
    var domain = "";
    try {
      if (/(^|\.)pfoten-plan\.de$/i.test(location.hostname))
        domain = "; domain=.pfoten-plan.de";
    } catch (e) {}
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      name + "=" + encodeURIComponent(value) +
      "; Max-Age=" + MAX_AGE + "; Path=/; SameSite=Lax" + domain + secure;
  }

  var url = new URLSearchParams(window.location.search);
  function p(k) {
    var v = url.get(k);
    return v ? decodeURIComponent(v) : "";
  }

  // ── E-Mail aus URL (für Marketing-Mails) — unverändert ──────────────────
  var emailFromUrl = url.get("email") || url.get("e") || url.get("user_email");
  if (emailFromUrl) {
    try {
      localStorage.setItem("userEmail", decodeURIComponent(emailFromUrl));
      localStorage.setItem("email_source", "url_parameter");
    } catch (e) {}
  }

  // ── FB-Cookies IMMER frisch halten (für CAPI), unabhängig vom First-Touch ─
  try {
    document.cookie.split(";").forEach(function (c) {
      var parts = c.trim().split("=");
      var n = parts[0],
        val = parts.slice(1).join("=");
      if (n === "_fbp" && val) localStorage.setItem("fbp", val);
      if (n === "_fbc" && val) localStorage.setItem("fbc", val);
    });
  } catch (e) {}

  // Spiegelt die First-Touch-utm set-once in die Legacy-localStorage-Keys,
  // damit bestehende Frontend-Reads (localStorage.getItem('utm_*')) den
  // First-Touch-Wert bekommen statt eines späteren Last-Touch.
  function mirrorToLegacy(obj) {
    try {
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(
        function (k) {
          if (obj[k] && !localStorage.getItem(k)) localStorage.setItem(k, obj[k]);
        }
      );
      if (obj.fbclid && !localStorage.getItem("fbclid"))
        localStorage.setItem("fbclid", obj.fbclid);
    } catch (e) {}
  }

  // ── Steht bereits ein First-Touch? Dann NIE überschreiben. ──────────────
  var existing = getCookie(ATTR_KEY);
  if (!existing) {
    try {
      existing = localStorage.getItem(ATTR_KEY);
    } catch (e) {}
  }
  if (existing) {
    // Cookie ggf. aus localStorage rekonstruieren (falls Cookie weg/abgelaufen)
    if (!getCookie(ATTR_KEY)) setCookie(ATTR_KEY, existing);
    try {
      var prev = JSON.parse(existing);
      window.ppAttr = function () {
        return prev;
      };
      mirrorToLegacy(prev);
    } catch (e) {}
    return; // First-Touch steht — fertig.
  }

  // ── Signale des AKTUELLEN Aufrufs sammeln ───────────────────────────────
  var clickIdMap = {
    fbclid: { source: "facebook", medium: "paid" },
    gclid: { source: "google", medium: "cpc" },
    ttclid: { source: "tiktok", medium: "paid" },
    msclkid: { source: "bing", medium: "cpc" },
    twclid: { source: "twitter", medium: "paid" },
  };

  var attr = {
    utm_source: p("utm_source"),
    utm_medium: p("utm_medium"),
    utm_campaign: p("utm_campaign"),
    utm_content: p("utm_content"),
    utm_term: p("utm_term"),
    fbclid: p("fbclid"),
  };
  try {
    attr.fbp = localStorage.getItem("fbp") || "";
  } catch (e) {
    attr.fbp = "";
  }

  var sawClickId = false;
  Object.keys(clickIdMap).forEach(function (cid) {
    var v = p(cid);
    if (v) {
      sawClickId = true;
      if (cid === "fbclid") attr.fbclid = v;
      else attr[cid] = v;
      if (!attr.utm_source) {
        attr.utm_source = clickIdMap[cid].source;
        attr.utm_medium = attr.utm_medium || clickIdMap[cid].medium;
      }
    }
  });

  // In-App-Browser (FB/IG/TikTok) → starkes Ad-Signal, falls keine utm
  var inApp = "";
  try {
    var ua = navigator.userAgent || "";
    if (/FBAN|FBAV/.test(ua)) inApp = "facebook";
    else if (/Instagram/.test(ua)) inApp = "instagram";
    else if (/TikTok|musical_ly/.test(ua)) inApp = "tiktok";
  } catch (e) {}
  if (inApp && !attr.utm_source) {
    attr.utm_source = inApp;
    attr.utm_medium = attr.utm_medium || "paid";
  }

  // STARKES Signal? Nur dann First-Touch „locken". Reines fbp/Direct ohne
  // utm/Click-ID/In-App lockt NICHT — damit ein späterer Ad-Klick noch greift.
  var hasStrongSignal =
    !!(attr.utm_source || attr.utm_campaign || attr.utm_content) ||
    sawClickId ||
    !!inApp;

  if (hasStrongSignal) {
    try {
      attr.first_visit = new Date().toISOString();
    } catch (e) {}
    try {
      attr.landing_page = window.location.href;
    } catch (e) {}
    // Leere Keys entfernen (kompaktes Cookie)
    Object.keys(attr).forEach(function (k) {
      if (!attr[k]) delete attr[k];
    });
    var json = JSON.stringify(attr);
    setCookie(ATTR_KEY, json);
    try {
      localStorage.setItem(ATTR_KEY, json);
    } catch (e) {}
    window.ppAttr = function () {
      return attr;
    };
    mirrorToLegacy(attr);
  } else {
    // Kein Lock — aber Erstbesuch-Infos für Analytics festhalten (einmalig)
    try {
      if (!localStorage.getItem("first_visit")) {
        localStorage.setItem("first_visit", new Date().toISOString());
        localStorage.setItem("landing_page", window.location.href);
        if (document.referrer) localStorage.setItem("referrer", document.referrer);
      }
    } catch (e) {}
    window.ppAttr = function () {
      return null;
    };
  }
})();
