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
      <div id="cookie-banner" style="position:fixed;left:0;right:0;bottom:0;background:#ffffff;padding:18px 20px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 -2px 12px rgba(0,0,0,0.08);border-top:2px solid #C4A576">
        <div style="max-width:600px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
          <div style="color:#555;font-size:14px;flex:1;min-width:200px;line-height:1.4">Diese Website verwendet Cookies. <a href="/datenschutz.html" style="color:#8B7355;text-decoration:underline">Datenschutzerklärung</a></div>
          <div style="display:flex;gap:10px;flex-shrink:0">
            <button id="cb-reject" style="background:transparent;color:#999;border:1px solid #ddd;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:500;font-size:14px">Ablehnen</button>
            <button id="cb-accept" style="background:linear-gradient(135deg,#C4A576,#8B7355);color:#fff;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px">Akzeptieren</button>
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