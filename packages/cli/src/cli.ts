import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "commander";
import open from "open";
import pc from "picocolors";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface CliOptions {
  port: number;
  host: string;
  open: boolean;
}

function resolveServerEntry(): string {
  const candidates = [
    join(__dirname, "web/apps/web/server.js"), // published package layout
    join(__dirname, "../dist/web/apps/web/server.js"), // monorepo dev layout
  ];

  const found = candidates.find((candidate) => existsSync(candidate));

  if (!found) {
    console.error(
      pc.red(
        "Could not find the bundled TokenCraft server. Run `pnpm build:cli` first."
      )
    );
    process.exit(1);
  }

  return found;
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.status < 500) {
        return true;
      }
    } catch {
      // Server not ready yet, keep polling.
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return false;
}

async function runServer(path: string | undefined, opts: CliOptions): Promise<void> {
  const root = path ? resolve(process.cwd(), path) : undefined;

  if (root && !existsSync(root)) {
    console.error(pc.red(`Path does not exist: ${root}`));
    process.exit(1);
  }

  const serverEntry = resolveServerEntry();

  console.log(pc.bold(pc.cyan("\n  TokenCraft")));
  console.log(pc.dim(`  ${root ?? "no project — pick one from the welcome screen"}\n`));

  const child = spawn(process.execPath, [serverEntry], {
    cwd: dirname(serverEntry),
    env: {
      ...process.env,
      PORT: String(opts.port),
      HOSTNAME: opts.host,
    },
    stdio: ["ignore", "pipe", "inherit"],
  });

  child.stdout?.on("data", () => {
    // Swallow Next.js's own startup logs; we print our own summary once ready.
  });

  const baseUrl = `http://${opts.host}:${opts.port}`;
  const ready = await waitForServer(baseUrl);

  if (!ready) {
    console.error(pc.red("  The server did not start in time."));
    child.kill();
    process.exit(1);
  }

  const url = root ? `${baseUrl}/?openPath=${encodeURIComponent(root)}` : baseUrl;

  console.log(`  ${pc.green("➜")}  Dashboard: ${pc.cyan(url)}`);
  console.log(pc.dim("\n  Press Ctrl+C to stop.\n"));

  if (opts.open) {
    await open(url).catch(() => {});
  }

  const shutdown = () => {
    console.log(pc.dim("\n  Shutting down…"));
    child.kill();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

const program = new Command();

program
  .name("tokencraft")
  .description("Local-first design token editor")
  .version("0.1.0");

program
  .argument("[path]", "project folder to open (omit to pick one from the welcome screen)")
  .option("-p, --port <port>", "port to bind", (v) => parseInt(v, 10), 4287)
  .option("--host <host>", "host to bind", "127.0.0.1")
  .option("--no-open", "do not open the browser automatically")
  .action(async (path: string | undefined, opts: CliOptions) => {
    await runServer(path, opts);
  });

program.parseAsync(process.argv);
