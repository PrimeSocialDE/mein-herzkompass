(function () {
  const CONSENT_KEY = 'wauwerk_consent_v1';
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
        // Fallback: WauWerk Braun-Design
        const fallback = document.createElement('div');
        fallback.innerHTML = `
          <div style="position:fixed;left:0;right:0;bottom:0;background:#ffffff;color:#2C2C2E;padding:20px;z-index:99999;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 -4px 20px rgba(0,0,0,0.1);border-top:3px solid #C4A576">
            <div style="max-width:600px;margin:0 auto;text-align:center">
              <div style="color:#8B7355;font-weight:700;margin-bottom:8px;font-size:18px">🍪 Cookie-Einstellungen</div>
              <div style="color:#6B6B6B;font-size:14px;margin-bottom:20px">Wir verwenden Cookies, um deinen Trainingsplan zu speichern und unsere Website zu verbessern. 
              <a href="/datenschutz.html" style="color:#C4A576;text-decoration:none;font-weight:600">Datenschutzerklärung</a></div>
              <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
                <button id="cb-reject" style="background:#f8f8f8;color:#999;border:1px solid #E8E4DF;padding:12px 24px;border-radius:8px;cursor:pointer;font:14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:600;transition:all 0.2s">Ablehnen</button>
                <button id="cb-accept" style="background:linear-gradient(135deg,#C4A576,#8B7355);color:#ffffff;border:none;padding:12px 24px;border-radius:8px;font-weight:700;cursor:pointer;font:14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;transition:all 0.2s;box-shadow:0 4px 15px rgba(196,165,118,0.3)">🐕 Alle akzeptieren</button>
              </div>
            </div>
          </div>`;
        
        document.body.appendChild(fallback);
        
        const acceptBtn = fallback.querySelector('#cb-accept');
        const rejectBtn = fallback.querySelector('#cb-reject');
        
        acceptBtn.onmouseover = () => acceptBtn.style.transform = 'translateY(-2px)';
        acceptBtn.onmouseout = () => acceptBtn.style.transform = 'translateY(0)';
        
        rejectBtn.onmouseover = () => {
          rejectBtn.style.background = '#f0f0f0';
          rejectBtn.style.color = '#666';
        };
        rejectBtn.onmouseout = () => {
          rejectBtn.style.background = '#f8f8f8';
          rejectBtn.style.color = '#999';
        };
        
        acceptBtn.onclick = () => { 
          setConsent({necessary:true,statistics:true,marketing:true}); 
          fallback.remove(); 
          log('Consent: accept all');
        };
        rejectBtn.onclick = () => { 
          setConsent({necessary:true,statistics:false,marketing:false}); 
          fallback.remove(); 
          log('Consent: reject marketing');
        };
      });
  });
})();