import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Moss ships a native/wasm core that can't be bundled — load it at runtime.
  serverExternalPackages: ["@moss-dev/moss", "@moss-dev/moss-core"],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // microphone=(self) required — Deepgram voice agent needs mic access
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
