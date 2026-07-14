import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import {
  commitWorkspaceTokenDrafts,
  TokenEditError,
} from "@/lib/workspaces/token-edit-operations";
import { tokensPagePath } from "@/lib/workspaces/repository-route-utils";

const commitSchema = z.object({
  message: z.string().trim().min(1),
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
    })
  ),
  pendingCollectionDeletes: z.array(z.string()).optional(),
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
  const parsed = commitSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid commit payload." }, { status: 400 });
  }

  try {
    const result = await commitWorkspaceTokenDrafts(session.scope, workspaceId, parsed.data);
    revalidatePath(tokensPagePath(workspaceId));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof TokenEditError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
