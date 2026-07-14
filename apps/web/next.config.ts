import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@tokencraft/core", "@tokencraft/ui"],
  outputFileTracingRoot: path.join(__dirname, "../..")
};

export default nextConfig;
