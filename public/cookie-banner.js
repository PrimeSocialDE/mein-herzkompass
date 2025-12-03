(function () {
  const CONSENT_KEY = 'wauwerk_consent_v1';

  function getConsent() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}'); } catch { return {}; }
  }
  function hasDecision() { return typeof getConsent().necessary !== 'undefined'; }
  function setConsent(obj) {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...obj, ts: Date.now() }));
  }

  if (hasDecision()) return;

  document.addEventListener('DOMContentLoaded', function(){
    const banner = document.createElement('div');
    banner.innerHTML = `
      <div id="cookie-banner" style="position:fixed;left:0;right:0;bottom:0;background:#ffffff;padding:20px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 -4px 20px rgba(0,0,0,0.1);border-top:3px solid #C4A576">
        <div style="max-width:600px;margin:0 auto;text-align:center">
          <div style="color:#8B7355;font-weight:700;margin-bottom:8px;font-size:18px">🍪 Cookie-Einstellungen</div>
          <div style="color:#6B6B6B;font-size:14px;margin-bottom:20px">Wir verwenden Cookies, um deinen Trainingsplan zu speichern und unsere Website zu verbessern. <a href="/datenschutz.html" style="color:#C4A576;font-weight:600">Datenschutzerklärung</a></div>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <button id="cb-reject" style="background:#f8f8f8;color:#999;border:1px solid #E8E4DF;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600">Ablehnen</button>
            <button id="cb-accept" style="background:linear-gradient(135deg,#C4A576,#8B7355);color:#fff;border:none;padding:12px 24px;border-radius:8px;font-weight:700;cursor:pointer">🐕 Alle akzeptieren</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(banner);

    document.getElementById('cb-accept').onclick = () => { 
      setConsent({necessary:true,statistics:true,marketing:true}); 
      banner.remove(); 
    };
    document.getElementById('cb-reject').onclick = () => { 
      setConsent({necessary:true,statistics:false,marketing:false}); 
      banner.remove(); 
    };
  });
})();