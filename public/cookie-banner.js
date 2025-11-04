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
        // Fallback: Professioneller Banner mit blauem Branding
        const fallback = document.createElement('div');
        fallback.innerHTML = `
          <div style="position:fixed;left:0;right:0;bottom:0;background:#ffffff;color:#334155;padding:20px;z-index:99999;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 -4px 20px rgba(0,0,0,0.1);border-top:3px solid #1e40af">
            <div style="max-width:1000px;margin:0 auto;display:flex;gap:16px;align-items:center;flex-wrap:wrap">
              <div style="flex:1;min-width:300px">
                <div style="color:#1e40af;font-weight:600;margin-bottom:4px">🍪 Cookie-Einstellungen</div>
                <div style="color:#64748b;font-size:14px">Wir verwenden Cookies, um Ihre Erfahrung zu verbessern und anonyme Statistiken zu erstellen. 
                <a href="/datenschutz.html" style="color:#1e40af;text-decoration:none;font-weight:500">Datenschutzerklärung</a></div>
              </div>
              <div style="display:flex;gap:12px;flex-wrap:wrap">
                <button id="cb-reject" style="background:#f8fafc;color:#475569;border:2px solid #e2e8f0;padding:12px 20px;border-radius:8px;cursor:pointer;font:14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:500;transition:all 0.2s;white-space:nowrap">Nur notwendige</button>
                <button id="cb-accept" style="background:#1e40af;color:#ffffff;border:2px solid #1e40af;padding:12px 20px;border-radius:8px;font-weight:600;cursor:pointer;font:14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;transition:all 0.2s;white-space:nowrap">Alle akzeptieren</button>
              </div>
            </div>
          </div>`;
        
        document.body.appendChild(fallback);
        
        // Hover-Effekte hinzufügen
        const acceptBtn = fallback.querySelector('#cb-accept');
        const rejectBtn = fallback.querySelector('#cb-reject');
        
        acceptBtn.onmouseover = () => acceptBtn.style.background = '#1d4ed8';
        acceptBtn.onmouseout = () => acceptBtn.style.background = '#1e40af';
        
        rejectBtn.onmouseover = () => {
          rejectBtn.style.background = '#f1f5f9';
          rejectBtn.style.borderColor = '#cbd5e1';
        };
        rejectBtn.onmouseout = () => {
          rejectBtn.style.background = '#f8fafc';
          rejectBtn.style.borderColor = '#e2e8f0';
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