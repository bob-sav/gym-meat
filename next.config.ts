import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  // (optional) uncomment if you ever need to ship despite TS errors:
  // typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["pdfkit", "fontkit"],
  // (optional) webpack rule only if you choose to bundle pdfkit instead of externalizing it
  // webpack: (config, { isServer }) => {
  //   if (isServer) {
  //     config.module.rules.push({
  //       test: /pdfkit[\/\\](js|lib)[\/\\]data[\/\\].*\.afm$/,
  //       type: "asset/resource",
  //     });
  //   }
  //   return config;
  // },
};

export default nextConfig;
