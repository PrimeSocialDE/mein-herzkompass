import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Root "/" zeigt auf deine statische Landing im public/
      { source: '/', destination: '/index.html' }
    ];
  },
  trailingSlash: false
};

export default nextConfig;