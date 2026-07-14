import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import {
  tokensPagePath,
  workspaceSettingsPath
} from "@/lib/workspaces/repository-route-utils";
import {
  importWorkspaceRepositoryTokenFiles,
  TokenOperationError
} from "@/lib/workspaces/token-operations";

const importFilesSchema = z.object({
  paths: z.array(z.string().min(1)).min(1)
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { workspaceId } = await params;
  const parsed = importFilesSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Select at least one JSON file." }, { status: 400 });
  }

  try {
    const { workspaceSlug, importedFileCount } = await importWorkspaceRepositoryTokenFiles(
      session.scope,
      workspaceId,
      parsed.data.paths
    );
    revalidatePath(tokensPagePath(workspaceSlug));
    revalidatePath(workspaceSettingsPath(workspaceSlug));
    return NextResponse.json({ ok: true, importedFileCount });
  } catch (error) {
    if (error instanceof TokenOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
