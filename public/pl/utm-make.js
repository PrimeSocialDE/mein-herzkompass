// ================== CONFIG ==================
var MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/pqrfyei3hcqod8ony3m4d4rs8ydo5mhz'; // deine Make-URL
var DEFAULT_PRICE_EUR = 39.00;

// ================== HELPERS ==================
function onReady(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
function getParam(name){ return new URLSearchParams(location.search).get(name); }
function getCookie(name){ var m=document.cookie.match(new RegExp('(^| )'+name+'=([^;]+)')); return m? m[2] : null; }
function setLS(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function getLS(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function sendToMake(payload){
  if(!MAKE_WEBHOOK_URL) return;
  var body = JSON.stringify(payload);
  try{
    if(navigator.sendBeacon){
      return navigator.sendBeacon(MAKE_WEBHOOK_URL, new Blob([body], {type:'application/json'}));
    }
    return fetch(MAKE_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body });
  }catch(e){}
}

// ================== MAIN ==================
onReady(function(){
  // 1) UTM & Click-IDs persistieren
  var utmKeys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
  var clickIds = ['fbclid','gclid','ttclid','msclkid'];
  utmKeys.concat(clickIds).forEach(function(k){ var v=getParam(k); if(v) setLS(k,v); });

  // 2) Meta fbp/fbc ableiten
  var fbp = getCookie('_fbp'); if(fbp) setLS('fbp', fbp);
  var fbclid = getLS('fbclid') || getParam('fbclid');
  var fbc = fbclid ? ('fb.1.'+Math.floor(Date.now()/1000)+'.'+fbclid) : null;
  if(fbc) setLS('fbc', fbc);

  // 3) Hidden-Felder automatisch befüllen (falls vorhanden)
  var allKeys = utmKeys.concat(['fbc','fbp','gclid','ttclid','msclkid']);
  allKeys.forEach(function(name){
    var val = getLS(name);
    if(!val) return;
    document.querySelectorAll('input[name="'+name+'"], textarea[name="'+name+'"]').forEach(function(el){
      if(!el.value) el.value = val;
    });
  });

  // 4) UTMs an Links/Buttons anhängen (.utm-link oder [data-append-utms])
  var qs = new URLSearchParams();
  utmKeys.forEach(function(k){ var v=getLS(k); if(v) qs.set(k,v); });
  ['fbc','fbp','gclid','ttclid','msclkid'].forEach(function(k){ var v=getLS(k); if(v) qs.set(k,v); });
  if(Array.from(qs.keys()).length){
    var suffix = '?' + qs.toString();
    document.querySelectorAll('a.utm-link, a[data-append-utms], button.utm-link, button[data-append-utms]').forEach(function(el){
      var href = el.getAttribute('href');
      if(href){ var base = href.split('?')[0]; el.setAttribute('href', base + suffix); }
    });
  }

  // 5) Checkout-Klicks erkennen → Make: InitiateCheckout
  document.addEventListener('click', function(e){
    var el = e.target;
    while(el && el!==document){
      var href = (el.getAttribute && el.getAttribute('href')) || '';
      var isCheckout = (el.hasAttribute && el.hasAttribute('data-checkout')) || el.id==='buy-btn' || (/stripe\.com/.test(href));
      if(isCheckout){
        var price = parseFloat(el.getAttribute('data-price')) || parseFloat(getLS('price_eur')) || DEFAULT_PRICE_EUR;
        setLS('price_eur', String(price));
        sendToMake({
          event_name: 'InitiateCheckout',
          event_time: Math.floor(Date.now()/1000),
          event_source_url: location.href,
          action_source: 'website',
          price_eur: price,
          currency: 'EUR',
          page_path: location.pathname,
          utm: {
            utm_source: getLS('utm_source'),
            utm_medium: getLS('utm_medium'),
            utm_campaign: getLS('utm_campaign'),
            utm_term: getLS('utm_term'),
            utm_content: getLS('utm_content')
          },
          click_ids: {
            fbc: getLS('fbc'),
            fbp: getLS('fbp'),
            gclid: getLS('gclid'),
            ttclid: getLS('ttclid'),
            msclkid: getLS('msclkid')
          },
          user_agent: navigator.userAgent
        });
        break;
      }
      el = el.parentNode;
    }
  });

  // 6) Success/Purchase erkennen (Stripe Success URL mit ?session_id=… [&amount=…])
  // DEDUPLIZIERUNG: Gleicher Key wie in tracking.js und zusatz.html
  var sessionId = getParam('session_id');
  var paymentIntent = getParam('payment_intent');
  var uniqueKey = paymentIntent || sessionId;
  var makeTrackingKey = 'wauwerk_make_purchase_' + uniqueKey;

  if(uniqueKey && !getLS(makeTrackingKey)){
    var amount = parseFloat(getParam('amount'));
    if(isNaN(amount)) amount = parseFloat(getLS('price_eur')) || DEFAULT_PRICE_EUR;
    sendToMake({
      event_name: 'Purchase',
      event_time: Math.floor(Date.now()/1000),
      event_source_url: location.href,
      action_source: 'website',
      session_id: sessionId,
      payment_intent: paymentIntent,
      price_eur: amount,
      currency: 'EUR',
      page_path: location.pathname,
      utm: {
        utm_source: getLS('utm_source'),
        utm_medium: getLS('utm_medium'),
        utm_campaign: getLS('utm_campaign'),
        utm_term: getLS('utm_term'),
        utm_content: getLS('utm_content')
      },
      click_ids: {
        fbc: getLS('fbc'),
        fbp: getLS('fbp'),
        gclid: getLS('gclid'),
        ttclid: getLS('ttclid'),
        msclkid: getLS('msclkid')
      },
      user_agent: navigator.userAgent
    });
    setLS(makeTrackingKey, '1');
    console.log('✅ Make Purchase gesendet für:', uniqueKey);
  } else if(uniqueKey) {
    console.log('⏭️ Make Purchase bereits gesendet für:', uniqueKey);
  }

  // 7) Optional: Form-Leads an Make
  document.querySelectorAll('form').forEach(function(form){
    form.addEventListener('submit', function(){
      var email = (form.querySelector('input[name="email"]')||{}).value || '';
      var phone = (form.querySelector('input[name="phone"], input[name="tel"]')||{}).value || '';
      sendToMake({
        event_name: 'Lead',
        event_time: Math.floor(Date.now()/1000),
        event_source_url: location.href,
        action_source: 'website',
        page_path: location.pathname,
        email: email,
        phone: phone,
        utm: {
          utm_source: getLS('utm_source'),
          utm_medium: getLS('utm_medium'),
          utm_campaign: getLS('utm_campaign'),
          utm_term: getLS('utm_term'),
          utm_content: getLS('utm_content')
        },
        click_ids: { fbc: getLS('fbc'), fbp: getLS('fbp') },
        user_agent: navigator.userAgent
      });
    }, {passive:true});
  });
});