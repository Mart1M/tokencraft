import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(__dirname, "..");
const repoRoot = join(cliRoot, "../..");

const standaloneDir = join(repoRoot, "apps/web/.next/standalone");
const staticDir = join(repoRoot, "apps/web/.next/static");
const publicDir = join(repoRoot, "apps/web/public");

const destRoot = join(cliRoot, "dist/web");
const destAppDir = join(destRoot, "apps/web");

if (!existsSync(standaloneDir)) {
  console.error(
    "apps/web/.next/standalone not found. Run `pnpm --filter @tokencraft/web build` first."
  );
  process.exit(1);
}

await rm(destRoot, { recursive: true, force: true });
await cp(standaloneDir, destRoot, { recursive: true });
await cp(staticDir, join(destAppDir, ".next/static"), { recursive: true });

if (existsSync(publicDir)) {
  await cp(publicDir, join(destAppDir, "public"), { recursive: true });
}

console.log(`Embedded web app into ${destRoot}`);
