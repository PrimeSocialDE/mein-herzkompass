// ab-test.js - 20/80 A/B Test (20% A, 80% B)
(function() {
    const TEST_CONFIG = {
        testName: 'landing_documents_vs_job_focused',
        variants: {
            A: '/index.html',              // Original (dokumente-fokussiert) - 20%
            B: '/index_job_fokus.html'     // Job-fokussiert - 80%
        },
        trafficSplit: 20 // 20% für A, 80% für B
    };

    function getVariant() {
        // Check if user already assigned
        let variant = localStorage.getItem('abTestVariant');
        
        if (!variant) {
            // 20/80 random assignment
            variant = Math.random() < 0.2 ? 'A' : 'B';
            
            // Store assignment
            localStorage.setItem('abTestVariant', variant);
            localStorage.setItem('abTestAssigned', new Date().toISOString());
            
            console.log('=== A/B TEST ASSIGNMENT (20/80) ===', variant);
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
                        page: targetPath === '/index.html' ? 'documents_focused' : 'job_focused',
                        traffic_split: '20_80'
                    });
                }
                
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'ab_test_view', {
                        'test_name': TEST_CONFIG.testName,
                        'variant': variant,
                        'page_type': targetPath === '/index.html' ? 'documents_focused' : 'job_focused',
                        'traffic_split': '20_80'
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