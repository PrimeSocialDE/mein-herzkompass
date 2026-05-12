import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Verhindert dass Next.js den public/-Folder als Function-Dependency
  // traced. Die PDF-Generators lesen Bytes via readFileSync — der Bundler
  // wuerde sonst zur Sicherheit ALLES aus public/ in jedes Function-Bundle
  // packen (Videos, ungenutzte PDFs etc.). PDF-Assets liegen separat unter
  // pdf-assets/ und werden gezielt mitgenommen.
  outputFileTracingExcludes: {
    "*": [
      "public/**/*.mp4",
      "public/**/*.mov",
      "public/**/*.webm",
      "public/**/*.pdf",
      "public/**/*.html",
    ],
  },
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