(function () {
    const CONSENT_KEY = 'consent_v1';     // bei Änderungen hochzählen
    const PATH_OK = location.pathname === '/' || location.pathname === '/index.html';
  
    function log(){ try{ console.log('[CookieBanner]', ...arguments); }catch(e){} }
    function getConsent() {
      try { return JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}'); } catch { return {}; }
    }
    function hasDecision() { return typeof getConsent().necessary !== 'undefined'; }
    function setConsent(obj) {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...obj, ts: Date.now() }));
      window.dispatchEvent(new Event('consentchange'));
    }
  
    document.addEventListener('DOMContentLoaded', function(){
      log('Init. path=', location.pathname, 'hasDecision=', hasDecision());
      if (!PATH_OK) { log('Not index page → no banner'); return; }
      if (hasDecision()) { log('Consent already set → no banner'); return; }
  
      // Banner HTML laden
      fetch('/banner.html', { cache: 'no-store' })
        .then(r => {
          if (!r.ok) throw new Error('banner.html HTTP ' + r.status);
          return r.text();
        })
        .then(html => {
          const holder = document.createElement('div');
          holder.innerHTML = html;
          document.body.appendChild(holder);
  
          const accept = document.getElementById('accept-cookies');
          const reject = document.getElementById('reject-cookies');
  
          if (!accept || !reject) {
            log('Buttons not found in banner.html (IDs accept-cookies / reject-cookies)');
            return;
          }
  
          accept.addEventListener('click', () => {
            setConsent({ necessary: true, statistics: true, marketing: true });
            holder.remove();
            log('Consent: accept all');
            // Optional: location.reload(); // falls du Tracking-Skripte neu initialisieren willst
          });
  
          reject.addEventListener('click', () => {
            setConsent({ necessary: true, statistics: false, marketing: false });
            holder.remove();
            log('Consent: reject marketing');
          });
  
          log('Banner shown.');
        })
        .catch(err => {
          log('Failed to load banner.html →', err.message);
          // Fallback: Minimalbanner inline anzeigen
          const fallback = document.createElement('div');
          fallback.innerHTML = `
            <div style="position:fixed;left:0;right:0;bottom:0;background:#111;color:#fff;padding:16px;z-index:99999;font:14px/1.4 system-ui">
              <div style="max-width:900px;margin:0 auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
                <div style="flex:1">Wir verwenden Cookies. <a href="/datenschutz.html" style="color:#9cf;text-decoration:underline">Mehr</a></div>
                <button id="cb-reject" style="background:#444;color:#fff;border:0;padding:10px 14px;border-radius:8px;cursor:pointer">Nur notwendig</button>
                <button id="cb-accept" style="background:#22c55e;color:#071;border:0;padding:10px 14px;border-radius:8px;font-weight:700;cursor:pointer">Alle akzeptieren</button>
              </div>
            </div>`;
          document.body.appendChild(fallback);
          fallback.querySelector('#cb-accept').onclick = () => { setConsent({necessary:true,statistics:true,marketing:true}); fallback.remove(); };
          fallback.querySelector('#cb-reject').onclick = () => { setConsent({necessary:true,statistics:false,marketing:false}); fallback.remove(); };
        });
    });
  })();