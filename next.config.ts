import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  // (optional) uncomment if you ever need to ship despite TS errors:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
