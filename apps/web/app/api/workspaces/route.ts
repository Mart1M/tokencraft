import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { getGitHubInstallationForScope } from "@/lib/workspaces/github-connection";
import { createWorkspaceForScope, listWorkspacesForScope } from "@/lib/workspaces/service";
import { serializeWorkspaceSummaries, serializeWorkspaceSummary } from "@/lib/workspaces/serialize";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const [workspaces, githubInstallation] = await Promise.all([
    listWorkspacesForScope(session.scope),
    getGitHubInstallationForScope(session.scope),
  ]);

  return NextResponse.json({
    workspaces: serializeWorkspaceSummaries(workspaces, {
      hasScopeGitHubInstallation: Boolean(githubInstallation),
    }),
  });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const parsed = createWorkspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workspace payload." }, { status: 400 });
  }

  try {
    const workspace = await createWorkspaceForScope(session.scope, {
      name: parsed.data.name,
    });

    return NextResponse.json(
      { workspace: serializeWorkspaceSummary(workspace) },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Unable to create workspace. Try a different name." },
        { status: 409 }
      );
    }

    console.error("Failed to create workspace:", error);

    return NextResponse.json(
      { error: "Unable to create workspace. Please try again." },
      { status: 500 }
    );
  }
}
