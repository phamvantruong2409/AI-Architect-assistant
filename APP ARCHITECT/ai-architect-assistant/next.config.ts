import type { NextConfig } from "next";
import path from "path";

// Trên Vercel: để Next/Vercel tự bundle (mọi tuỳ chỉnh standalone/file-tracing
// dành cho build Electron cục bộ đều gây 500 cho API route trên Vercel).
const isVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  serverExternalPackages: ["trash"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.adsttc.com" }],
  },
  ...(isVercel
    ? {}
    : {
        output: "standalone",
        outputFileTracingRoot: path.join(__dirname),
        outputFileTracingExcludes: {
          "*": ["./dist/**", "./electron/**", "./scripts/**"],
        },
        turbopack: {
          root: __dirname,
        },
      }),
};

export default nextConfig;
