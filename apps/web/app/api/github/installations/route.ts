import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { toDbScope } from "@/lib/auth/scope";

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const installation = await prisma.gitHubInstallation.findUnique({
    where: {
      scope_ownerId: {
        scope: toDbScope(session.scope.scope),
        ownerId: session.scope.ownerId,
      },
    },
    select: {
      id: true,
      installationId: true,
      accountLogin: true,
      accountType: true,
      repositoryIds: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    installations: installation
      ? [
          {
            ...installation,
            installationId: installation.installationId.toString(),
            repositoryIds: installation.repositoryIds.map((id) => id.toString()),
          },
        ]
      : [],
  });
}
