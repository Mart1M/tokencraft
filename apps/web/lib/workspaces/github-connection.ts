import { Prisma } from "@prisma/client";
import type { GitHubAccountType, GitHubInstallation } from "@prisma/client";

import { toDbScope, type ActorScope } from "@/lib/auth/scope";
import { prisma } from "@/lib/db/prisma";

type InstallationInput = {
  installationId: bigint;
  accountLogin: string;
  accountType: GitHubAccountType;
};

function isInstallationIdConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("installationId")
  );
}

export async function getGitHubInstallationForScope(scope: ActorScope) {
  return prisma.gitHubInstallation.findUnique({
    where: {
      scope_ownerId: {
        scope: toDbScope(scope.scope),
        ownerId: scope.ownerId,
      },
    },
    include: {
      repositories: {
        orderBy: {
          fullName: "asc",
        },
      },
    },
  });
}

async function persistGitHubInstallation(
  tx: Prisma.TransactionClient,
  scope: ActorScope,
  installation: InstallationInput
) {
  const scopeData = {
    scope: toDbScope(scope.scope),
    ownerId: scope.ownerId,
  };

  const linkData = {
    accountLogin: installation.accountLogin,
    accountType: installation.accountType,
    ...scopeData,
  };

  const existingInstallation = await tx.gitHubInstallation.findUnique({
    where: { installationId: installation.installationId },
  });

  if (existingInstallation) {
    return tx.gitHubInstallation.update({
      where: { id: existingInstallation.id },
      data: linkData,
    });
  }

  try {
    return await tx.gitHubInstallation.create({
      data: {
        installationId: installation.installationId,
        repositoryIds: [],
        ...linkData,
      },
    });
  } catch (error) {
    if (!isInstallationIdConflict(error)) {
      throw error;
    }

    return tx.gitHubInstallation.update({
      where: { installationId: installation.installationId },
      data: linkData,
    });
  }
}

export async function linkGitHubInstallationToScope(
  scope: ActorScope,
  installation: InstallationInput
): Promise<GitHubInstallation> {
  const previousInstallation = await getGitHubInstallationForScope(scope);

  if (
    previousInstallation &&
    previousInstallation.installationId !== installation.installationId
  ) {
    await prisma.gitHubInstallation.delete({
      where: { id: previousInstallation.id },
    });
  }

  return prisma.$transaction(async (tx) => {
    const githubInstallation = await persistGitHubInstallation(tx, scope, installation);

    await tx.workspace.updateMany({
      where: {
        scope: toDbScope(scope.scope),
        ownerId: scope.ownerId,
        selectedRepositoryId: { not: null },
      },
      data: {
        selectedRepositoryId: null,
        activeBranch: null,
        connectionStatus: "INSTALLATION_CONNECTED",
      },
    });

    await tx.workspace.updateMany({
      where: {
        scope: toDbScope(scope.scope),
        ownerId: scope.ownerId,
        connectionStatus: "NOT_CONNECTED",
      },
      data: {
        connectionStatus: "INSTALLATION_CONNECTED",
      },
    });

    return githubInstallation;
  });
}

export async function unlinkGitHubInstallationFromScope(scope: ActorScope) {
  const installation = await getGitHubInstallationForScope(scope);

  if (!installation) {
    return;
  }

  await prisma.$transaction([
    prisma.tokenFile.deleteMany({
      where: {
        workspace: {
          scope: toDbScope(scope.scope),
          ownerId: scope.ownerId,
        },
      },
    }),
    prisma.tokenScan.deleteMany({
      where: {
        workspace: {
          scope: toDbScope(scope.scope),
          ownerId: scope.ownerId,
        },
      },
    }),
    prisma.workspace.updateMany({
      where: {
        scope: toDbScope(scope.scope),
        ownerId: scope.ownerId,
      },
      data: {
        selectedRepositoryId: null,
        activeBranch: null,
        connectionStatus: "NOT_CONNECTED",
      },
    }),
    prisma.gitHubInstallation.delete({
      where: { id: installation.id },
    }),
  ]);
}

export async function clearWorkspaceRepositorySelection(workspaceId: string) {
  await prisma.$transaction([
    prisma.tokenFile.deleteMany({
      where: { workspaceId },
    }),
    prisma.tokenScan.deleteMany({
      where: { workspaceId },
    }),
    prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        selectedRepository: { disconnect: true },
        activeBranch: null,
        connectionStatus: "INSTALLATION_CONNECTED",
      },
    }),
  ]);
}
