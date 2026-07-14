import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import {
  createWorkspaceBranch,
  listWorkspaceRepositoryBranches,
  switchWorkspaceBranch,
} from "@/lib/workspaces/branch-operations";
import { tokensPagePath, workspaceSettingsPath } from "@/lib/workspaces/repository-route-utils";
import { TokenOperationError } from "@/lib/workspaces/token-operations";

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
    const payload = await listWorkspaceRepositoryBranches(session.scope, workspaceId);
    return NextResponse.json(payload);
  } catch (error) {
    const status = error instanceof TokenOperationError ? error.status : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list branches." },
      { status }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { workspaceId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "switch" | "create";
    branch?: string;
    name?: string;
    fromBranch?: string;
  };

  try {
    if (body.action === "create") {
      const result = await createWorkspaceBranch(session.scope, workspaceId, {
        name: body.name ?? "",
        fromBranch: body.fromBranch,
      });

      revalidatePath(tokensPagePath(result.workspaceSlug));
      revalidatePath(workspaceSettingsPath(result.workspaceSlug));

      return NextResponse.json(result);
    }

    const result = await switchWorkspaceBranch(
      session.scope,
      workspaceId,
      body.branch ?? ""
    );

    revalidatePath(tokensPagePath(result.workspaceSlug));
    revalidatePath(workspaceSettingsPath(result.workspaceSlug));

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof TokenOperationError ? error.status : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Branch action failed." },
      { status }
    );
  }
}
