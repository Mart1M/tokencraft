import { NextResponse } from "next/server";
import { z } from "zod";

import { assertDirectory } from "@/lib/tokens/fs";
import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";
import {
  deleteWorkspaceCollectionMode,
  ModeOperationError,
  renameWorkspaceCollectionMode,
  toModeOperationError,
} from "@/lib/workspaces/mode-operations";

const modeSchema = z.object({
  rootPath: z.string().trim().min(1).transform(sanitizeFolderPathInput),
  fileId: z.string().min(1),
  modes: z.array(z.string().trim().min(1)).min(1),
});

const renameSchema = modeSchema.extend({
  action: z.literal("rename"),
  oldMode: z.string().trim().min(1),
  newMode: z.string().trim().min(1),
});

const deleteSchema = modeSchema.extend({
  action: z.literal("delete"),
  mode: z.string().trim().min(1),
});

const requestSchema = z.discriminatedUnion("action", [renameSchema, deleteSchema]);

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mode payload." }, { status: 400 });
  }

  try {
    await assertDirectory(parsed.data.rootPath);

    if (parsed.data.action === "rename") {
      const result = await renameWorkspaceCollectionMode(parsed.data.rootPath, {
        fileId: parsed.data.fileId,
        oldMode: parsed.data.oldMode,
        newMode: parsed.data.newMode,
        modes: parsed.data.modes,
      });

      return NextResponse.json({ ok: true, ...result });
    }

    const result = await deleteWorkspaceCollectionMode(parsed.data.rootPath, {
      fileId: parsed.data.fileId,
      mode: parsed.data.mode,
      modes: parsed.data.modes,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ModeOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw toModeOperationError(error);
  }
}
