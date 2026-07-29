// ab-test.js - Simple 50/50 A/B Test
(function() {
    const TEST_CONFIG = {
        testName: 'landing_documents_vs_job_focused',
        variants: {
            A: '/index.html',              // Original (dokumente-fokussiert)
            B: '/index_job_fokus.html'     // Job-fokussiert
        },
        trafficSplit: 50 // 50/50 split
    };

    function getVariant() {
        // Check if user already assigned
        let variant = localStorage.getItem('abTestVariant');
        
        if (!variant) {
            // 50/50 random assignment
            variant = Math.random() < 0.5 ? 'A' : 'B';
            
            // Store assignment
            localStorage.setItem('abTestVariant', variant);
            localStorage.setItem('abTestAssigned', new Date().toISOString());
            
            console.log('=== A/B TEST ASSIGNMENT ===', variant);
        }
        
        return variant;
    }

    function redirectToVariant() {
        const currentPath = window.location.pathname;
        const variant = getVariant();
        const targetPath = TEST_CONFIG.variants[variant];
        
        // Only redirect if on root and not already on target
        if (currentPath === '/' || currentPath === '/index.html') {
            if (targetPath !== currentPath) {
                // Track assignment
                if (typeof fbq !== 'undefined') {
                    fbq('track', 'ABTestView', {
                        test_name: TEST_CONFIG.testName,
                        variant: variant,
                        page: targetPath === '/index.html' ? 'documents_focused' : 'job_focused'
                    });
                }
                
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'ab_test_view', {
                        'test_name': TEST_CONFIG.testName,
                        'variant': variant,
                        'page_type': targetPath === '/index.html' ? 'documents_focused' : 'job_focused'
                    });
                }
                
                // Redirect to correct variant
                if (variant === 'B') {
                    window.location.href = '/index_job_fokus.html' + window.location.search;
                }
                // Variant A stays on current page
            }
        }
    }

    // Run test
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', redirectToVariant);
    } else {
        redirectToVariant();
    }
})();