import { NextResponse } from "next/server";
import { z } from "zod";

import { assertDirectory, WorkspaceFsError, writeWorkspaceTokenDrafts } from "@/lib/tokens/fs";
import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";
import { CollectionOperationError, createWorkspaceCollection } from "@/lib/workspaces/collection-operations";
import {
  addWorkspaceCollectionMode,
  deleteWorkspaceCollectionMode,
  ModeOperationError,
  renameWorkspaceCollectionMode,
} from "@/lib/workspaces/mode-operations";

const draftSchema = z.object({
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
  colorModifier: z.object({
    type: z.enum(["lighten", "darken", "alpha", "mix"]),
    space: z.enum(["srgb", "p3", "hsl", "lch"]),
    value: z.string().min(1),
    color: z.string().optional(),
    format: z.string().optional(),
  }).nullable().optional(),
});

const requestSchema = z.object({
  rootPath: z.string().trim().min(1).transform(sanitizeFolderPathInput),
  drafts: z.array(draftSchema),
  pendingCollectionDeletes: z.array(z.string()).default([]),
  collectionCreates: z.array(z.object({
    path: z.string().trim().min(1),
    collectionName: z.string().trim().optional(),
  })).default([]),
  modeChanges: z.array(z.discriminatedUnion("action", [
    z.object({
      fileId: z.string().min(1), action: z.literal("add"), mode: z.string().min(1), modes: z.array(z.string().min(1)).min(1),
    }),
    z.object({
      fileId: z.string().min(1), action: z.literal("rename"), oldMode: z.string().min(1), newMode: z.string().min(1), modes: z.array(z.string().min(1)).min(1),
    }),
    z.object({
      fileId: z.string().min(1), action: z.literal("delete"), mode: z.string().min(1), modes: z.array(z.string().min(1)).min(1),
    }),
  ])).default([]),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid changes payload." }, { status: 400 });
  }

  const input = parsed.data;
  if (!input.drafts.length && !input.pendingCollectionDeletes.length && !input.collectionCreates.length && !input.modeChanges.length) {
    return NextResponse.json({ error: "No changes to save." }, { status: 400 });
  }

  try {
    await assertDirectory(input.rootPath);

    for (const change of input.collectionCreates) {
      await createWorkspaceCollection(input.rootPath, change);
    }

    for (const change of input.modeChanges) {
      if (change.action === "add") {
        await addWorkspaceCollectionMode(input.rootPath, change);
      } else if (change.action === "rename") {
        await renameWorkspaceCollectionMode(input.rootPath, change);
      } else {
        await deleteWorkspaceCollectionMode(input.rootPath, change);
      }
    }

    let savedFileCount = 0;
    if (input.drafts.length || input.pendingCollectionDeletes.length) {
      const result = await writeWorkspaceTokenDrafts(input.rootPath, {
        drafts: input.drafts,
        pendingCollectionDeletes: input.pendingCollectionDeletes,
      });
      savedFileCount += result.savedFileCount;
    }

    return NextResponse.json({ ok: true, savedFileCount });
  } catch (error) {
    if (error instanceof WorkspaceFsError || error instanceof CollectionOperationError || error instanceof ModeOperationError) {
      return NextResponse.json({ error: error.message, status: error.status }, { status: error.status });
    }
    throw error;
  }
}
