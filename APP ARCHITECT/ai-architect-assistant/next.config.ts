import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["trash"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.adsttc.com" },
    ],
  },
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingExcludes: {
    "*": ["./dist/**", "./electron/**", "./scripts/**"],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
