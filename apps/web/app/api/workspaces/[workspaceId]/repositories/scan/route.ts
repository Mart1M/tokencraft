import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import {
  scanWorkspaceRepository,
  TokenOperationError
} from "@/lib/workspaces/token-operations";

function tokensPagePath(workspaceSlug: string) {
  return `/dashboard/workspaces/${workspaceSlug}/tokens`;
}

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
    const { workspaceSlug } = await scanWorkspaceRepository(session.scope, workspaceId);
    revalidatePath(tokensPagePath(workspaceSlug));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TokenOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
