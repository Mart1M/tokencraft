import { NextResponse } from "next/server";

import { collectTokenModes } from "@/lib/tokens/display";
import { getImportedTokenRows, getTokenSidebarCollections } from "@/lib/tokens/entries";
import { assertDirectory, readWorkspaceTokenFiles, WorkspaceFsError } from "@/lib/tokens/fs";
import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRootPath = searchParams.get("root");

  if (!rawRootPath) {
    return NextResponse.json({ error: "A root path is required." }, { status: 400 });
  }

  const rootPath = sanitizeFolderPathInput(rawRootPath);

  try {
    await assertDirectory(rootPath);
    const files = await readWorkspaceTokenFiles(rootPath);
    const tokens = getImportedTokenRows(files);
    const collections = getTokenSidebarCollections(files);
    const modes = collectTokenModes(tokens);

    return NextResponse.json({
      rootPath,
      tokens,
      collections,
      modes,
      tokenFileCount: files.length,
    });
  } catch (error) {
    if (error instanceof WorkspaceFsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
