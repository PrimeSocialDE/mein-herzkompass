// UTM Parameter beim Seitenaufruf speichern
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Nur speichern wenn Parameter vorhanden sind (erste Seite vom Ad-Klick)
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid'];
    
    utmKeys.forEach(key => {
        const value = urlParams.get(key);
        if (value) {
            localStorage.setItem(key, value);
            console.log(`UTM gespeichert: ${key} = ${value}`);
        }
    });
    
    // Zusätzlich: Referrer speichern wenn noch nicht vorhanden
    if (document.referrer && !localStorage.getItem('referrer')) {
        localStorage.setItem('referrer', document.referrer);
    }
    
    // Landing Page speichern wenn noch nicht vorhanden
    if (!localStorage.getItem('landing_page')) {
        localStorage.setItem('landing_page', window.location.pathname);
    }
    
    // Timestamp des ersten Besuchs
    if (!localStorage.getItem('first_visit')) {
        localStorage.setItem('first_visit', new Date().toISOString());
    }
})();