/* ================== META PIXEL ================== */
(function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)})(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq=window.fbq||function(){};
    fbq('init','804110612194796');
    fbq('track','PageView');
    
    /* ================== CLARITY ================== */
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "te5set74fl");
    
    /* ================== TIKTOK PIXEL ================== */
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t;
      var ttq = w[t] = w[t] || [];
      ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
      ttq.setAndDefer = function(t,e){t[e]=function(){t.push([e].concat([].slice.call(arguments,0)))}};
      for (var i=0;i<ttq.methods.length;i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function(t){var e=ttq._i[t] = ttq._i[t] || []; for (var n=0;n<ttq.methods.length;n++) ttq.setAndDefer(e, ttq.methods[n]); return e;};
      ttq.load = function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {}; ttq._i[e]=[]; ttq._t = ttq._t || {}; ttq._t[e]=+new Date; ttq._o = ttq._o || {}; ttq._o[e]=n || {};
        var s=d.createElement("script"); s.type="text/javascript"; s.async=!0; s.src=r+"?sdkid="+e+"&lib="+t;
        var x=d.getElementsByTagName("script")[0]; x.parentNode.insertBefore(s,x);
      };
      ttq.load('D37SIKRC77UF115GBJQ0');  // dein TikTok Pixel
      ttq.page();
    }(window, document, 'ttq');
    
    /* ================== HELPERS ================== */
    function onReady(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
    function safeClarity(name, data){ try{ if(typeof clarity==='function'){ clarity('event', name, data||{}); } }catch(e){} }
    
    /* ================== SERVER-ENDPOINT URLs ================== */
    /* hier trägst du deine sicheren Endpoints ein */
    var META_CAPI_URL = '';     // z. B. 'https://hook.eu1.make.com/DEINE_ID' oder '/api/meta-capi'
    var TIKTOK_CAPI_URL = '';   // z. B. 'https://hook.eu1.make.com/DEINE_ID' oder '/api/tiktok-capi'
    
    function sendServerEvent(url, body){
      if(!url) return;
      try{
        navigator.sendBeacon
          ? navigator.sendBeacon(url, new Blob([JSON.stringify(body)], {type:'application/json'}))
          : fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      }catch(e){}
    }
    
    /* ================== TRACKING LOGIK ================== */
    onReady(function(){
      var step = location.pathname.replace(/\.html$/,'') || '/';
      fbq('trackCustom','StepView',{ step: step });
      safeClarity('step_view',{ step: step });
      try{ ttq.track('ViewContent',{ content_name: step }); }catch(e){}
    
      document.addEventListener('click', function(e){
        var el = e.target;
        while(el && el !== document){
          var href = (el.getAttribute && el.getAttribute('href')) || '';
          var isCheckoutAttr = el.hasAttribute && el.hasAttribute('data-checkout');
          var isBuyId = el.id === 'buy-btn';
          var isStripeLink = typeof href === 'string' && /stripe\.com/.test(href);
    
          if(isCheckoutAttr || isBuyId || isStripeLink){
            var price = parseFloat(el.getAttribute('data-price')) || parseFloat(localStorage.getItem('price_eur')) || 39.00;
            fbq('track','InitiateCheckout',{ value: price, currency: 'EUR' });
            safeClarity('initiate_checkout',{ amount: price, step: step });
            try{ ttq.track('InitiateCheckout',{ value: price, currency: 'EUR' }); }catch(e){}
    
            // serverseitig weiterleiten (CAPI)
            sendServerEvent(META_CAPI_URL,{ event_name:'InitiateCheckout', value: price, currency:'EUR' });
            sendServerEvent(TIKTOK_CAPI_URL,{ event_name:'InitiateCheckout', value: price, currency:'EUR' });
    
            localStorage.setItem('price_eur', String(price));
            break;
          }
          el = el.parentNode;
        }
      });
    
      // Purchase Tracking - NICHT auf zusatz.html (dort wird es separat gehandhabt)
      var isZusatzPage = location.pathname.includes('zusatz');
      if(isZusatzPage){
        console.log('⏭️ tracking.js: Auf zusatz.html - Purchase wird dort gehandhabt');
        return;
      }

      var qs = new URLSearchParams(location.search);
      var hasSession = qs.get('session_id');
      var paymentIntent = qs.get('payment_intent');
      var amountUrl = qs.get('amount');
      var amount = !isNaN(parseFloat(amountUrl)) ? parseFloat(amountUrl) : (parseFloat(localStorage.getItem('price_eur')) || 39.00);

      // Gleicher Key wie in zusatz.html für konsistente Deduplizierung
      var uniqueKey = paymentIntent || hasSession;

      if(uniqueKey){
        // Deduplizierung: Nur einmal pro Session/Payment tracken
        var trackingKey = 'wauwerk_purchase_tracked_' + uniqueKey;
        if(localStorage.getItem(trackingKey)){
          console.log('⏭️ Purchase bereits getrackt für:', uniqueKey);
          return;
        }

        fbq('track','Purchase',{ value: amount, currency: 'EUR' });
        safeClarity('purchase',{ amount: amount, source:'stripe_checkout', session_id: hasSession });
        try{ ttq.track('Purchase',{ value: amount, currency: 'EUR' }); }catch(e){}

        sendServerEvent(META_CAPI_URL,{ event_name:'Purchase', value: amount, currency:'EUR', session_id: hasSession });
        sendServerEvent(TIKTOK_CAPI_URL,{ event_name:'Purchase', value: amount, currency:'EUR', session_id: hasSession });

        // Als getrackt markieren
        localStorage.setItem(trackingKey, '1');
        console.log('✅ Purchase getrackt für:', uniqueKey);
      }
    });