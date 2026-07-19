# TokenCraft for Figma

Import the local design tokens managed by TokenCraft into Figma Variables.
The plugin maintains a live WebSocket connection to TokenCraft’s local bridge
at `ws://localhost:4288`; it does not upload token data to a hosted service.
Changes to the workspace’s token files are sent to the open plugin automatically.

## Development install

1. Run `pnpm build:figma-plugin`.
2. In Figma desktop, go to **Plugins → Development → Import plugin from manifest…**.
3. Select `packages/figma-plugin/manifest.json`.
4. Start TokenCraft with its CLI (`npx tokencraft /absolute/path/to/tokens`), then run the plugin in Figma.
5. Enter the absolute path of the token workspace. The plugin finds the local bridge automatically — there is no URL to configure.

The UI bundle is embedded into `dist/ui.html` at build time. After changing the
plugin, rebuild it and use **Plugins → Development → Reload plugin** in Figma.

## Imported values

| TokenCraft type | Figma Variable |
| --- | --- |
| `color` | Color |
| `number`, `fontWeight`, `dimension`, `duration` | Number |
| `boolean` | Boolean |
| `fontFamily`, `strokeStyle` | String |

Aliases are imported when their target is also selected and compatible. Composite
tokens (for example `border`, `shadow`, `typography`, `gradient`, and
`transition`) are reported in the import summary because Figma Variables do not
have an equivalent value type.
