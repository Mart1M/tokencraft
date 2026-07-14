import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import {
  pullWorkspaceTokenChanges,
  TokenEditError,
} from "@/lib/workspaces/token-edit-operations";
import { tokensPagePath } from "@/lib/workspaces/repository-route-utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    const result = await pullWorkspaceTokenChanges(session.scope, workspaceId);
    revalidatePath(tokensPagePath(workspaceId));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof TokenEditError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
