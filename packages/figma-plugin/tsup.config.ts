import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { code: "src/code.ts" },
    format: ["iife"],
    platform: "browser",
    target: "es2017",
    outDir: "dist",
    dts: false,
    minify: false,
    tsconfig: "tsconfig.code.json",
  },
  {
    entry: { ui: "src/ui.ts" },
    format: ["iife"],
    platform: "browser",
    target: "es2017",
    outDir: "dist",
    dts: false,
    minify: false,
    tsconfig: "tsconfig.ui.json",
  },
]);
