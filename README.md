# TokenCraft

A local-first design token editor. It runs entirely on your machine, auto-detects
`*.tokens.json` files in a project folder, and lets you view and edit them from
a browser-based dashboard — no accounts, no git, no external services.

## Usage

```bash
npx tokencraft ./path/to/your/tokens   # open a project directly
npx tokencraft                          # pick a project from the welcome screen
```

TokenCraft looks for `**/*.tokens.json` files under the folder you open, or the
file list in an optional `tokencraft.config.json` at the folder's root:

```json
{
  "version": 1,
  "files": ["tokens/core.tokens.json", "tokens/semantic.tokens.json"]
}
```

Edits are staged in the browser and written back to the source JSON files on
disk — atomically — when you click **Save changes**. Workspaces (which local
folder you've opened, and under what name) are remembered in your browser's
`localStorage`; nothing is uploaded anywhere.

See [`examples/basic`](examples/basic) for a minimal sample project:

```bash
npx tokencraft ./examples/basic
```

## Stack

- Next.js App Router in `apps/web`, serving both the UI and a small filesystem
  API (`apps/web/lib/tokens/fs.ts`)
- `tokencraft` CLI in `packages/cli`, which bundles the built Next.js app
  (`next build` with `output: "standalone"`) and launches it as a local server
- Shared domain types in `packages/core`

## Development

```bash
pnpm install
pnpm dev              # apps/web on http://localhost:3000
pnpm test
pnpm typecheck
```

Building the redistributable CLI (build the web app first, since the CLI
embeds its standalone output):

```bash
pnpm build
pnpm build:cli
node packages/cli/dist/cli.js ./examples/basic
```
