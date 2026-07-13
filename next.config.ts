import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Email images are fetched by mail clients / image proxies (Gmail,
        // Outlook, Apple Mail). Serve them publicly with a long, immutable
        // cache so proxies cache a stable copy and never re-hit the origin.
        source: "/email/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
