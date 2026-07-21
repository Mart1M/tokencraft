import { NextResponse } from "next/server";

import { collectTokenModes } from "@/lib/tokens/display";
import { getImportedTokenRows, getTokenSidebarCollections } from "@/lib/tokens/entries";
import { assertDirectory, getWorkspaceFolderPaths, readWorkspaceTokenFiles, WorkspaceFsError } from "@/lib/tokens/fs";
import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";
import { DEFAULT_MODE_STORAGE, parseTokencraftConfig, resolveModeStorage, TOKENCRAFT_CONFIG_FILENAME } from "@/lib/tokencraft/config";
import fs from "node:fs/promises";
import path from "node:path";

const FIGMA_ORIGIN = "https://www.figma.com";

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");

  if (origin !== FIGMA_ORIGIN) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": FIGMA_ORIGIN,
    "Vary": "Origin",
  };
}

const preflightHeaders = {
  "Access-Control-Allow-Origin": FIGMA_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Vary": "Origin",
};

export function OPTIONS(request: Request) {
  const headers = getCorsHeaders(request);
  return new Response(null, { status: 204, headers: Object.keys(headers).length ? preflightHeaders : {} });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRootPath = searchParams.get("root");

  if (!rawRootPath) {
    return NextResponse.json({ error: "A root path is required." }, { status: 400, headers: getCorsHeaders(request) });
  }

  const rootPath = sanitizeFolderPathInput(rawRootPath);

  try {
    await assertDirectory(rootPath);
    const [files, folders, modeStorage] = await Promise.all([
      readWorkspaceTokenFiles(rootPath),
      getWorkspaceFolderPaths(rootPath),
      (async () => {
        try {
          const raw = await fs.readFile(path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8");
          return resolveModeStorage(parseTokencraftConfig(raw));
        } catch {
          return DEFAULT_MODE_STORAGE;
        }
      })(),
    ]);
    const tokens = getImportedTokenRows(files);
    const collections = getTokenSidebarCollections(files);
    const modes = collectTokenModes(tokens);

    return NextResponse.json({
      rootPath,
      tokens,
      collections,
      folders,
      modes,
      modeStorage,
      tokenFileCount: files.length,
    }, { headers: getCorsHeaders(request) });
  } catch (error) {
    if (error instanceof WorkspaceFsError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: getCorsHeaders(request) });
    }

    throw error;
  }
}
