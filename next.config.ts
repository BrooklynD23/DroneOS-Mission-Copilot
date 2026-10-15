import type { NextConfig } from "next";

const tileHost = process.env.NEXT_PUBLIC_TILE_URL
  ? new URL(process.env.NEXT_PUBLIC_TILE_URL.replace(/\{[^}]*\}/g, "0")).origin
  : "";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: https://tile.openstreetmap.org${tileHost ? ` ${tileHost}` : ""}`,
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingIncludes: {
    "/api/plan": [
      "./public/replays/*/mission.json",
      "./public/replays/*/telemetry.jsonl",
    ],
  },
  async headers() {
    const headers =
      process.env.NODE_ENV === "production"
        ? [...baseHeaders, { key: "Content-Security-Policy", value: csp }]
        : baseHeaders;
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
