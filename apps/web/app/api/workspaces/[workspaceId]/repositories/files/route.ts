import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import {
  listWorkspaceRepositoryJsonFiles,
  TokenOperationError
} from "@/lib/workspaces/token-operations";

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
    const result = await listWorkspaceRepositoryJsonFiles(session.scope, workspaceId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TokenOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
