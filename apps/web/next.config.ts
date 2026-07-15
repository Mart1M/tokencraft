import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@tokencraft/core"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  output: "standalone"
};

export default nextConfig;
