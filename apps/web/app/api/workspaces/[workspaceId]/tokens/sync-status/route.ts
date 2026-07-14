import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getWorkspaceTokenSyncStatus } from "@/lib/workspaces/token-edit-operations";
import { tokensPagePath } from "@/lib/workspaces/repository-route-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    const status = await getWorkspaceTokenSyncStatus(session.scope, workspaceId);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read sync status." },
      { status: 400 }
    );
  }
}
