import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Schwere npm-Packages NICHT ins Function-Bundle packen, sondern
  // separat installieren lassen. Vercel laedt sie zur Runtime via
  // require() statt sie zu bundlen. Spart pro Function ~5-10 MB.
  serverExternalPackages: [
    "pdf-lib",
    "@pdf-lib/standard-fonts",
    "@pdf-lib/upng",
    "qrcode",
    "pngjs",
    "@anthropic-ai/sdk",
    "@supabase/supabase-js",
    "@supabase/ssr",
  ],

  // Verhindert dass Next.js den public/-Folder als Function-Dependency
  // traced. Die PDF-Generators lesen Bytes via readFileSync — der Bundler
  // wuerde sonst zur Sicherheit ALLES aus public/ in jedes Function-Bundle
  // packen (Videos, ungenutzte PDFs etc.). PDF-Assets liegen separat unter
  // pdf-assets/ und werden gezielt mitgenommen.
  outputFileTracingExcludes: {
    "*": [
      // public/ — alles raus (wird als statische Assets via CDN ausgeliefert,
      // nie aus Server-Code gelesen).
      "public/**/*",
      // Andere Generator-Scripts (nur fuer CLI-Sample-Builds, nicht von
      // Production-Server-Code referenziert).
      "generate-monatsplan-pdf.mjs",
      "generate-3monatsplan-pdf.mjs",
      "generate-6monatsplan-pdf.mjs",
      "generate-zusatzmodul-pdf.mjs",
      "generate-ernaehrung-*.mjs",
      "generate-erstehilfe-pdf.mjs",
      "generate-notfall-pdf.mjs",
      "generate-reise-pdf.mjs",
      "generate-tagebuch-pdf.mjs",
      // Test-/Build-Scripts
      "scripts/**/*",
      // Sichere Excludes (Build-Tools, niemals Runtime):
      "node_modules/typescript/**/*",
      "node_modules/@types/**/*",
      // Sharp/Image-Optimization — wir setzen images.unoptimized
      "node_modules/@img/**/*",
      "node_modules/sharp/**/*",
      // Build-only Native Binaries fuer andere Plattformen
      "node_modules/lightningcss-darwin-arm64/**/*",
      "node_modules/lightningcss-darwin-x64/**/*",
      "node_modules/lightningcss-win32-x64-msvc/**/*",
      "node_modules/@swc/core-darwin-arm64/**/*",
      "node_modules/@swc/core-darwin-x64/**/*",
      "node_modules/@swc/core-win32-x64-msvc/**/*",
      // Build-only DBs
      "node_modules/caniuse-lite/**/*",
      // Tailwind/PostCSS (build-only)
      "node_modules/@tailwindcss/**/*",
      "node_modules/tailwindcss/**/*",
    ],
  },

  // Image-Optimization deaktivieren — wir nutzen kein next/image,
  // Bilder werden direkt aus /public ausgeliefert.
  images: {
    unoptimized: true,
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