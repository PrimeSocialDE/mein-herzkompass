import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // alle Step-Seiten ohne .html erreichbar machen
      { source: '/:step(step\\d+)', destination: '/:step.html' },

      // Einzelmappings für weitere Seiten ohne .html
      { source: '/ergebnis', destination: '/ergebnis.html' },
      { source: '/geld-zurueck', destination: '/geld-zurueck.html' }
    ];
  }
};

export default nextConfig;