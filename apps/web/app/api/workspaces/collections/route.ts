import { NextResponse } from "next/server";
import { z } from "zod";

import { assertDirectory, WorkspaceFsError } from "@/lib/tokens/fs";
import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";
import { CollectionOperationError, createWorkspaceCollection } from "@/lib/workspaces/collection-operations";

const createSchema = z.object({
  rootPath: z.string().trim().min(1).transform(sanitizeFolderPathInput),
  path: z.string().trim().optional(),
  collectionName: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid collection payload." }, { status: 400 });
  }

  try {
    await assertDirectory(parsed.data.rootPath);
    const collection = await createWorkspaceCollection(parsed.data.rootPath, parsed.data);
    return NextResponse.json({ ok: true, collection });
  } catch (error) {
    if (error instanceof CollectionOperationError || error instanceof WorkspaceFsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
