import { NextResponse } from "next/server";
import { z } from "zod";

import { assertDirectory, initWorkspaceConfig, WorkspaceFsError } from "@/lib/tokens/fs";
import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";

const requestSchema = z.object({
  rootPath: z.string().trim().min(1).transform(sanitizeFolderPathInput),
  modeStorage: z.enum(["value-map", "separate-files"]).optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workspace init payload." }, { status: 400 });
  }

  try {
    await assertDirectory(parsed.data.rootPath);
    const result = await initWorkspaceConfig(parsed.data.rootPath, {
      modeStorage: parsed.data.modeStorage,
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      modeStorage: result.modeStorage,
    });
  } catch (error) {
    if (error instanceof WorkspaceFsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
