import { existsSync } from "node:fs";
import { cp, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(__dirname, "..");
const repoRoot = join(cliRoot, "../..");

const standaloneDir = join(repoRoot, "apps/web/.next/standalone");
const staticDir = join(repoRoot, "apps/web/.next/static");
const publicDir = join(repoRoot, "apps/web/public");
const repoNodeModules = join(repoRoot, "node_modules");

const destRoot = join(cliRoot, "dist/web");
const destAppDir = join(destRoot, "apps/web");

if (!existsSync(standaloneDir)) {
  console.error(
    "apps/web/.next/standalone not found. Run `pnpm --filter @tokencraft/web build` first."
  );
  process.exit(1);
}

function parsePnpmEntry(entry) {
  if (entry.startsWith("@")) {
    const slash = entry.indexOf("+");
    const atVersion = entry.lastIndexOf("@");

    if (slash === -1 || atVersion <= slash) {
      return null;
    }

    const scope = entry.slice(1, slash);
    const name = entry.slice(slash + 1, atVersion);
    return `@${scope}/${name}`;
  }

  const atVersion = entry.indexOf("@");
  if (atVersion <= 0) {
    return null;
  }

  return entry.slice(0, atVersion);
}

async function copyPackageFromRepo(packageName, destNodeModules) {
  const source = join(repoNodeModules, packageName);
  const target = join(destNodeModules, packageName);

  if (!existsSync(join(source, "package.json"))) {
    return false;
  }

  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.split("/");
    await cp(join(source), join(destNodeModules, scope, name), {
      recursive: true,
      force: true,
      dereference: true,
    });
    return true;
  }

  await cp(source, target, {
    recursive: true,
    force: true,
    dereference: true,
  });
  return true;
}

async function copyTracedPackagesFromRepo() {
  const pnpmDir = join(destRoot, "node_modules/.pnpm");
  const destNodeModules = join(destRoot, "node_modules");

  if (!existsSync(pnpmDir) || !existsSync(repoNodeModules)) {
    return;
  }

  const packageNames = new Set();

  for (const entry of await readdir(pnpmDir)) {
    const packageName = parsePnpmEntry(entry);

    if (packageName) {
      packageNames.add(packageName);
    }
  }

  for (const packageName of packageNames) {
    await copyPackageFromRepo(packageName, destNodeModules);
  }
}

await rm(destRoot, { recursive: true, force: true });
await cp(standaloneDir, destRoot, { recursive: true, dereference: true });
await cp(staticDir, join(destAppDir, ".next/static"), { recursive: true });

if (existsSync(publicDir)) {
  await cp(publicDir, join(destAppDir, "public"), { recursive: true });
}

await copyTracedPackagesFromRepo();

// Traced flat copies are enough at runtime; drop the pnpm store to shrink the tarball.
const embeddedPnpmDir = join(destRoot, "node_modules/.pnpm");
if (existsSync(embeddedPnpmDir)) {
  await rm(embeddedPnpmDir, { recursive: true, force: true });
}

const nextPackageJson = join(destRoot, "node_modules/next/package.json");
if (!existsSync(nextPackageJson)) {
  console.error(
    "Standalone bundle is missing node_modules/next after embed. Rebuild apps/web and retry."
  );
  process.exit(1);
}

console.log(`Embedded web app into ${destRoot}`);
