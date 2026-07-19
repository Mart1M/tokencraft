import { NextResponse } from "next/server";
import { z } from "zod";

import { assertDirectory, exportFigmaCollection, WorkspaceFsError } from "@/lib/tokens/fs";
import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";

const exportSchema = z.object({
  rootPath: z.string().trim().min(1).transform(sanitizeFolderPathInput),
  collection: z.object({
    name: z.string().trim().min(1),
    modes: z.array(z.string().trim().min(1)).max(100),
    tokens: z.array(z.object({
      name: z.string().trim().min(1),
      type: z.enum(["color", "number", "boolean", "string"]),
      values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    })).min(1).max(10_000),
  }),
});

export async function POST(request: Request) {
  const parsed = exportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid Figma collection export." }, { status: 400 });

  try {
    await assertDirectory(parsed.data.rootPath);
    const collection = await exportFigmaCollection(parsed.data.rootPath, parsed.data.collection);
    return NextResponse.json({ ok: true, collection });
  } catch (error) {
    if (error instanceof WorkspaceFsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
