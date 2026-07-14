import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import {
  CollectionOperationError,
  deleteWorkspaceCollection,
} from "@/lib/workspaces/collection-operations";
import { tokensPagePath } from "@/lib/workspaces/repository-route-utils";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; fileId: string }> }
) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { workspaceId, fileId } = await params;

  try {
    const result = await deleteWorkspaceCollection(session.scope, workspaceId, fileId);
    revalidatePath(tokensPagePath(workspaceId));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CollectionOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
