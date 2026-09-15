import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  // A self-contained server with a trimmed node_modules, for the Docker image and the
  // `testing-toolkit-dashboard` launcher (bin/cli.js) to run without a separate `npm install`.
  output: "standalone",
  // The file tracer otherwise sweeps in the whole `src/` (matching the `@/*` tsconfig path)
  // and the fixture data; neither is needed to run the built server.
  outputFileTracingExcludes: {
    "*": ["fixtures/**", "e2e/**", "docs/**", "**/*.test.ts", "**/playwright-report/**"],
  },
};

export default nextConfig;
