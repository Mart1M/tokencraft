import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { normalizeInstallationId } from "@/lib/github/installation-id";
import { verifyGitHubSignature } from "@/lib/github/webhook";

type GitHubInstallationPayload = {
  installation?: {
    id?: number;
    account?: {
      login?: string;
      type?: "User" | "Organization";
    };
  };
  repositories?: Array<{ id?: number }>;
};

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "GitHub webhook secret is not configured." }, { status: 500 });
  }

  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyGitHubSignature({ payload, signature, secret })) {
    return NextResponse.json({ error: "Invalid GitHub signature." }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  const body = JSON.parse(payload) as GitHubInstallationPayload;

  if (event === "installation" || event === "installation_repositories") {
    const installationId = body.installation?.id;
    const accountLogin = body.installation?.account?.login;

    if (installationId && accountLogin) {
      const normalizedInstallationId = normalizeInstallationId(installationId);
      const repositoryIds = (body.repositories ?? [])
        .map((repository) => repository.id)
        .filter((id): id is number => typeof id === "number")
        .map((id) => BigInt(id));

      const existingInstallation = await prisma.gitHubInstallation.findUnique({
        where: { installationId: normalizedInstallationId },
      });

      if (existingInstallation) {
        await prisma.gitHubInstallation.update({
          where: { id: existingInstallation.id },
          data: {
            accountLogin,
            accountType:
              body.installation?.account?.type === "Organization" ? "ORGANIZATION" : "USER",
            repositoryIds,
          },
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
