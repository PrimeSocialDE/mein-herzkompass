/* OpenAI / ChatGPT Ads Pixel (oaiq) — standalone.
   Für Seiten, die NICHT das große tracking.js laden (Landing-, Danke-,
   Rechtstexte-Seiten etc.). Lädt nur den OpenAI-Pixel, sonst nichts.
   Auf Seiten mit tracking.js NICHT zusätzlich einbinden (dort ist oaiq schon drin).

   Verwendung auf einer Seite:
     <script src="/oaiq.js" defer></script>
   Ein Event feuern (Event-Namen von OpenAI):
     window.oaiqMeasure('lead_created',  { type:'customer_action' });
     window.oaiqMeasure('order_created', { type:'contents', value: 39.99, currency:'EUR' });
     window.oaiqMeasure('page_viewed',   { type:'contents' });
*/
(function (w, d, s, u) {
  if (w.oaiq) return;
  var q = function () { q.q.push(arguments); };
  q.q = [];
  w.oaiq = q;
  var j = d.createElement(s); j.async = 1; j.src = u;
  var f = d.getElementsByTagName(s)[0];
  f.parentNode.insertBefore(j, f);
})(window, document, "script", "https://bzrcdn.openai.com/sdk/oaiq.min.js");

oaiq("init", { pixelId: "EqCK4x27xqXvid8k7ctioD", debug: true });

/* Sicherer Event-Helfer — wirft nie, auch wenn das SDK (noch) nicht geladen ist. */
window.oaiqMeasure = function (event, data) {
  try { if (typeof oaiq === "function") oaiq("measure", event, data || { type: "customer_action" }); } catch (e) {}
};

/* PageView auf jeder Seite, die dieses Script lädt. */
window.oaiqMeasure("page_viewed", { type: "contents" });
