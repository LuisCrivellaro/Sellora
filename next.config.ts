import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  output: process.env.SELLORA_DESKTOP_BUILD === "1" ? "standalone" : undefined,
};

export default nextConfig;
