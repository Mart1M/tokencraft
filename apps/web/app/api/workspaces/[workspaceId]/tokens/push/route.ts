import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import {
  pushWorkspaceTokenChanges,
  TokenEditError,
} from "@/lib/workspaces/token-edit-operations";
import { tokensPagePath } from "@/lib/workspaces/repository-route-utils";

const pushSchema = z.object({
  message: z.string().trim().min(1),
  fileIds: z.array(z.string()).optional(),
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
  const parsed = pushSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Commit message is required to push." }, { status: 400 });
  }

  try {
    const result = await pushWorkspaceTokenChanges(session.scope, workspaceId, parsed.data);
    revalidatePath(tokensPagePath(workspaceId));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof TokenEditError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
