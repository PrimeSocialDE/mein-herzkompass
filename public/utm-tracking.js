// ==================== WAUWERK UTM & TRACKING v2.0 ====================
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // ========== 0. E-Mail aus URL speichern (für Marketing E-Mails) ==========
    const emailFromUrl = urlParams.get('email') || urlParams.get('e') || urlParams.get('user_email');
    if (emailFromUrl) {
        localStorage.setItem('userEmail', decodeURIComponent(emailFromUrl));
        localStorage.setItem('email_source', 'url_parameter');
        console.log('📧 E-Mail aus URL erkannt:', emailFromUrl);
    }
    
    // ========== 1. UTM Parameter speichern ==========
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    utmKeys.forEach(key => {
        const value = urlParams.get(key);
        if (value) {
            localStorage.setItem(key, value);
        }
    });
    
    // ========== 2. Click IDs speichern + Auto-Detect Source ==========
    const clickIdMap = {
        'fbclid': { source: 'facebook', medium: 'paid' },
        'gclid': { source: 'google', medium: 'cpc' },
        'ttclid': { source: 'tiktok', medium: 'paid' },
        'msclkid': { source: 'bing', medium: 'cpc' },
        'twclid': { source: 'twitter', medium: 'paid' }
    };
    
    Object.keys(clickIdMap).forEach(clickId => {
        const value = urlParams.get(clickId);
        if (value) {
            localStorage.setItem(clickId, value);
            
            // Auto-Detect: utm_source aus Click ID ableiten wenn nicht vorhanden
            if (!localStorage.getItem('utm_source')) {
                localStorage.setItem('utm_source', clickIdMap[clickId].source);
                localStorage.setItem('utm_source_auto', 'click_id');
            }
            if (!localStorage.getItem('utm_medium')) {
                localStorage.setItem('utm_medium', clickIdMap[clickId].medium);
            }
        }
    });
    
    // ========== 3. Erster Besuch - Zusätzliche Infos ==========
    if (!localStorage.getItem('first_visit')) {
        localStorage.setItem('first_visit', new Date().toISOString());
        localStorage.setItem('landing_page', window.location.href);
        
        // Referrer speichern + Auto-Detect
        if (document.referrer) {
            localStorage.setItem('referrer', document.referrer);
            
            // Auto-Detect: utm_source aus Referrer ableiten
            if (!localStorage.getItem('utm_source')) {
                const ref = document.referrer.toLowerCase();
                const refMap = {
                    'facebook.com': { source: 'facebook', medium: 'social' },
                    'fb.com': { source: 'facebook', medium: 'social' },
                    'l.facebook.com': { source: 'facebook', medium: 'social' },
                    'lm.facebook.com': { source: 'facebook', medium: 'social' },
                    'instagram.com': { source: 'instagram', medium: 'social' },
                    'l.instagram.com': { source: 'instagram', medium: 'social' },
                    'google.': { source: 'google', medium: 'organic' },
                    'tiktok.com': { source: 'tiktok', medium: 'social' },
                    'youtube.com': { source: 'youtube', medium: 'social' },
                    'bing.com': { source: 'bing', medium: 'organic' },
                    't.co': { source: 'twitter', medium: 'social' },
                    'linkedin.com': { source: 'linkedin', medium: 'social' }
                };
                
                for (const [domain, data] of Object.entries(refMap)) {
                    if (ref.includes(domain)) {
                        localStorage.setItem('utm_source', data.source);
                        localStorage.setItem('utm_medium', data.medium);
                        localStorage.setItem('utm_source_auto', 'referrer');
                        break;
                    }
                }
            }
        }
        
        // ========== 4. In-App Browser Detection (Facebook/Instagram/TikTok App) ==========
        try {
            const ua = navigator.userAgent;
            
            // Device Type
            let device = 'desktop';
            if (/Mobile|Android|iPhone/i.test(ua)) device = 'mobile';
            else if (/iPad|Tablet/i.test(ua)) device = 'tablet';
            localStorage.setItem('device_type', device);
            
            // Browser erkennen
            let browser = 'other';
            if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'chrome';
            else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'safari';
            else if (ua.includes('Firefox')) browser = 'firefox';
            else if (ua.includes('Edg')) browser = 'edge';
            localStorage.setItem('browser', browser);
            
            // In-App Browser erkennen
            if (ua.includes('FBAN') || ua.includes('FBAV')) {
                localStorage.setItem('in_app_browser', 'facebook');
                if (!localStorage.getItem('utm_source')) {
                    localStorage.setItem('utm_source', 'facebook');
                    localStorage.setItem('utm_medium', 'paid');
                    localStorage.setItem('utm_source_auto', 'in_app_browser');
                }
            } else if (ua.includes('Instagram')) {
                localStorage.setItem('in_app_browser', 'instagram');
                if (!localStorage.getItem('utm_source')) {
                    localStorage.setItem('utm_source', 'instagram');
                    localStorage.setItem('utm_medium', 'paid');
                    localStorage.setItem('utm_source_auto', 'in_app_browser');
                }
            } else if (ua.includes('TikTok') || ua.includes('musical_ly')) {
                localStorage.setItem('in_app_browser', 'tiktok');
                if (!localStorage.getItem('utm_source')) {
                    localStorage.setItem('utm_source', 'tiktok');
                    localStorage.setItem('utm_medium', 'paid');
                    localStorage.setItem('utm_source_auto', 'in_app_browser');
                }
            }
        } catch(e) {}
    }
    
    // ========== 5. Facebook Cookies auslesen ==========
    try {
        document.cookie.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (name === '_fbp' && value) localStorage.setItem('fbp', value);
            if (name === '_fbc' && value) localStorage.setItem('fbc', value);
        });
    } catch(e) {}
    
    // ========== 6. Debug Log ==========
    console.log('📊 WauWerk Tracking v2.0:', {
        email: localStorage.getItem('userEmail'),
        email_source: localStorage.getItem('email_source'),
        utm_source: localStorage.getItem('utm_source'),
        utm_medium: localStorage.getItem('utm_medium'),
        utm_campaign: localStorage.getItem('utm_campaign'),
        utm_source_auto: localStorage.getItem('utm_source_auto'),
        fbclid: localStorage.getItem('fbclid'),
        gclid: localStorage.getItem('gclid'),
        ttclid: localStorage.getItem('ttclid'),
        fbp: localStorage.getItem('fbp'),
        referrer: localStorage.getItem('referrer'),
        device_type: localStorage.getItem('device_type'),
        browser: localStorage.getItem('browser'),
        in_app_browser: localStorage.getItem('in_app_browser'),
        first_visit: localStorage.getItem('first_visit'),
        landing_page: localStorage.getItem('landing_page')
    });
})();