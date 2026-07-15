import { NextResponse } from "next/server";
import { z } from "zod";

import { assertDirectory, WorkspaceFsError, writeWorkspaceTokenDrafts } from "@/lib/tokens/fs";
import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";

const saveSchema = z.object({
  rootPath: z.string().trim().min(1).transform(sanitizeFolderPathInput),
  drafts: z.array(
    z.object({
      tokenId: z.string().min(1),
      fileId: z.string().min(1),
      path: z.string().min(1),
      type: z.string().optional(),
      mode: z.string().nullable(),
      valueKind: z.enum(["alias", "literal"]),
      rawValue: z.string(),
      operation: z.enum(["create", "update", "delete"]).optional(),
      description: z.string().optional(),
      extensions: z.record(z.string(), z.string()).optional(),
    })
  ),
  pendingCollectionDeletes: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid save payload." }, { status: 400 });
  }

  try {
    await assertDirectory(parsed.data.rootPath);
    const result = await writeWorkspaceTokenDrafts(parsed.data.rootPath, {
      drafts: parsed.data.drafts,
      pendingCollectionDeletes: parsed.data.pendingCollectionDeletes,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof WorkspaceFsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
