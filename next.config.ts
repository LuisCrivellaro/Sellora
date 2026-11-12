import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingIncludes: { "/api/demos/jobs": ["./.agents/skills/unique-site-designer/**/*.md"] },
  outputFileTracingExcludes: { "/*": ["./.sellora-data/**/*", "./test-results/**/*", "./release/**/*", "./.desktop-web/**/*", "./.claw3d/**/*", "./src/**/*"] },
  output: process.env.SELLORA_DESKTOP_BUILD === "1" ? "standalone" : undefined,
};

export default nextConfig;
