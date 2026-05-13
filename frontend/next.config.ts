import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Set NEXT_PUBLIC_OFFLINE_BUILD=1 to produce a fully static, downloadable
// PWA build (no Next.js server, no API routes, no Sentry tunnel route).
// The result is a self-contained `out/` directory you can zip, host, or
// load from disk. Compute runs entirely in the browser via localAnalyzer
// + localApi, so the app stays usable with no network.
const OFFLINE = process.env.NEXT_PUBLIC_OFFLINE_BUILD === "1";

const nextConfig: NextConfig = {
  reactCompiler: true,
  ...(OFFLINE
    ? {
        output: "export" as const,
        // Static export can't optimise images at runtime.
        images: { unoptimized: true },
        // Add a trailing slash so deep links work when served from a plain
        // filesystem or any static host without server-side routing.
        trailingSlash: true,
      }
    : {}),
};

// Sentry's tunnelRoute installs a Next.js API route, which is incompatible
// with `output: 'export'`. Skip the Sentry wrapper entirely for offline
// builds -- error reporting wouldn't work without network anyway.
export default OFFLINE
  ? nextConfig
  : withSentryConfig(nextConfig, {
      org: "anticipater-gmbh",
      project: "smns-graphanalyzer",
      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
      disableLogger: true,
      automaticVercelMonitors: true,
    });
