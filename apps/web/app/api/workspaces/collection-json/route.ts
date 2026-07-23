import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  assertDirectory,
  readWorkspaceTokenFiles,
  WorkspaceFsError,
} from "@/lib/tokens/fs";
import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";

function toAbsolutePath(rootPath: string, relativePath: string) {
  const normalizedRoot = path.resolve(rootPath);
  const resolved = path.resolve(normalizedRoot, relativePath);

  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new WorkspaceFsError("Path escapes the workspace root.", 400);
  }

  return resolved;
}

function formatJsonContent(raw: string) {
  try {
    return `${JSON.stringify(JSON.parse(raw), null, 2)}\n`;
  } catch {
    return raw;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRootPath = searchParams.get("root");
  const fileId = searchParams.get("fileId");

  if (!rawRootPath || !fileId) {
    return NextResponse.json(
      { error: "A root path and fileId are required." },
      { status: 400 }
    );
  }

  const rootPath = sanitizeFolderPathInput(rawRootPath);

  try {
    await assertDirectory(rootPath);
    const files = await readWorkspaceTokenFiles(rootPath);
    const collection = files.find((file) => file.id === fileId);

    if (!collection) {
      return NextResponse.json({ error: "Collection not found." }, { status: 404 });
    }

    const tabs =
      collection.modeFiles && Object.keys(collection.modeFiles).length > 0
        ? (collection.configuredModes ?? Object.keys(collection.modeFiles)).map((mode) => ({
            mode,
            path: collection.modeFiles![mode],
          }))
        : [{ mode: null as string | null, path: collection.path }];

    const documents = [];

    for (const tab of tabs) {
      if (!tab.path) {
        continue;
      }

      try {
        const raw = await fs.readFile(toAbsolutePath(rootPath, tab.path), "utf8");
        documents.push({
          mode: tab.mode,
          path: tab.path,
          content: formatJsonContent(raw),
        });
      } catch {
        documents.push({
          mode: tab.mode,
          path: tab.path,
          content: null,
          error: "File could not be read.",
        });
      }
    }

    return NextResponse.json({
      collectionId: collection.id,
      collectionName: collection.collectionName,
      modeStorage: collection.modeStorage ?? "value-map",
      documents,
    });
  } catch (error) {
    if (error instanceof WorkspaceFsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
