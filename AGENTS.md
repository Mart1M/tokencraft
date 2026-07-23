# AGENTS.md

## Cursor Cloud specific instructions

TokenCraft is a **local-first design token editor** monorepo (pnpm workspaces, Node >= 20.9, pnpm 9). There is no database, backend service, or external dependency — all state lives on the local filesystem and in the browser's `localStorage`.

Standard commands are documented in `README.md` and the root `package.json` scripts (`dev`, `dev:docs`, `build`, `build:cli`, `build:figma-plugin`, `lint`, `test`, `typecheck`). Prefer those; notes below only capture non-obvious caveats.

### Services

- `@tokencraft/web` (`apps/web`) — the main product. Next.js App Router app that serves both the UI and the filesystem API (`/api/workspaces/*`). Dev server: `pnpm dev` on port **3000**.
- `tokencraft` CLI (`packages/cli`) — bundles the built web app's Next.js standalone output and launches it locally (default port **4287**); also starts a Figma WebSocket bridge on port **4288**. Requires `pnpm build` before `pnpm build:cli` (the CLI embeds the standalone build).
- `@tokencraft/docs` (`apps/docs`) — optional Fumadocs site, `pnpm dev:docs` on port **3001**.
- `@tokencraft/figma-plugin` — optional Figma desktop plugin; only relevant for Figma sync testing.

### Running / testing the editor end-to-end

- The fastest way to open a workspace without the native folder picker is the `openPath` query param: `http://localhost:3000/?openPath=/absolute/path/to/project`. Use `/workspace/examples/basic` as sample data.
- Workspaces are persisted in the browser's `localStorage`, not on the server — a fresh browser profile starts with no workspaces. `openPath` auto-registers/opens one.
- Editing flow: click a token, change its value, **Apply** (stages the change locally), then **Save** (writes back to the source `*.tokens.json` on disk, atomically). To verify a save actually persisted, check the file on disk (e.g. `git status`/`grep` under the opened folder) rather than relying only on UI feedback.
- The native folder picker (`/api/workspaces/browse-native`) shells out to `zenity`/`kdialog` (Linux); these are not installed by default. Not needed if you open folders via `openPath` or the CLI arg.

### Known pre-existing issues (NOT caused by environment setup)

- `pnpm lint` currently reports pre-existing errors in the repo's own code (e.g. `apps/web/lib/compose-refs.ts`). The lint tooling itself works.
- `pnpm test` has 1 pre-existing failing test (`tests/token-lifecycle-all-types.test.ts`, a `formatDraftValue` `undefined.trim()` error); the other 139 pass and the Vitest runner works.

Do not "fix" these as part of environment setup.

### Gotchas

- `.npmrc` sets `node-linker=hoisted` (flat `node_modules`) so the Next.js standalone build resolves correctly when copied into the CLI package. Keep installs going through pnpm; do not switch package managers.
- `pnpm build` writes `apps/web/next-env.d.ts` (tracked file) — it may show as modified after a build; this is expected and can be reverted.
