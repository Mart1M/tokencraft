import { mkdir, readFile, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });

const [template, bundle] = await Promise.all([
  readFile("src/ui.html", "utf8"),
  readFile("dist/ui.global.js", "utf8"),
]);

const script = `<script>${bundle.replace(/<\/script/gi, "<\\/script")}</script>`;

if (!template.includes("<!-- TOKENSCRAFT_UI_SCRIPT -->")) {
  throw new Error("TokenCraft UI template is missing its script placeholder.");
}

await writeFile(
  "dist/ui.html",
  template.replace("<!-- TOKENSCRAFT_UI_SCRIPT -->", script),
  "utf8",
);
