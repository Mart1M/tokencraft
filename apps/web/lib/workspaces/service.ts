import type { GitHubInstallation, GitHubRepository, TokenFile, TokenScan, Workspace } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { toDbScope, type ActorScope } from "@/lib/auth/scope";
import { getGitHubInstallationForScope } from "@/lib/workspaces/github-connection";
import { normalizeWorkspaceSlug } from "@/lib/workspaces/slug";

export { normalizeWorkspaceSlug };

type GitHubInstallationWithRepositories = GitHubInstallation & {
  repositories: GitHubRepository[];
};

export type WorkspaceWithGitHub = Workspace & {
  githubInstallation: GitHubInstallationWithRepositories | null;
  selectedRepository: GitHubRepository | null;
};

export type WorkspaceTokenExplorer = WorkspaceWithGitHub & {
  tokenFiles: TokenFile[];
  tokenScans: TokenScan[];
};

async function attachScopeGitHubInstallation<T extends Workspace>(
  scope: ActorScope,
  workspace: T
): Promise<T & { githubInstallation: GitHubInstallationWithRepositories | null }> {
  const githubInstallation = await getGitHubInstallationForScope(scope);

  return {
    ...workspace,
    githubInstallation,
  };
}

async function attachScopeGitHubInstallations<T extends Workspace>(
  scope: ActorScope,
  workspaces: T[]
) {
  const githubInstallation = await getGitHubInstallationForScope(scope);

  return workspaces.map((workspace) => ({
    ...workspace,
    githubInstallation,
  }));
}

async function generateUniqueWorkspaceSlug(scope: ActorScope, value: string) {
  const baseSlug = normalizeWorkspaceSlug(value);
  let candidate = baseSlug;
  let suffix = 2;

  while (
    await prisma.workspace.findFirst({
      where: {
        scope: toDbScope(scope.scope),
        ownerId: scope.ownerId,
        slug: candidate,
      },
      select: { id: true },
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function getDefaultWorkspaceInput(scope: ActorScope) {
  if (scope.scope === "organization") {
    return {
      name: "Organization workspace",
      slug: "workspace",
    };
  }

  return {
    name: "Personal workspace",
    slug: "workspace",
  };
}

export async function listWorkspacesForScope(scope: ActorScope) {
  const workspaces = await prisma.workspace.findMany({
    where: {
      scope: toDbScope(scope.scope),
      ownerId: scope.ownerId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      selectedRepository: true,
    },
  });

  return attachScopeGitHubInstallations(scope, workspaces);
}

export async function getWorkspaceForScope(scope: ActorScope, workspaceId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      scope: toDbScope(scope.scope),
      ownerId: scope.ownerId,
      OR: [{ id: workspaceId }, { slug: workspaceId }],
    },
    include: {
      selectedRepository: true,
    },
  });

  if (!workspace) {
    return null;
  }

  return attachScopeGitHubInstallation(scope, workspace);
}

export async function getWorkspaceTokenExplorer(scope: ActorScope, workspaceId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      scope: toDbScope(scope.scope),
      ownerId: scope.ownerId,
      OR: [{ id: workspaceId }, { slug: workspaceId }],
    },
    include: {
      selectedRepository: true,
      tokenFiles: {
        orderBy: {
          path: "asc",
        },
      },
      tokenScans: {
        orderBy: {
          startedAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!workspace) {
    return null;
  }

  return attachScopeGitHubInstallation(scope, workspace) as Promise<WorkspaceTokenExplorer | null>;
}

export async function ensureWorkspaceForScope(scope: ActorScope, workspaceId: string) {
  const existingWorkspace = await getWorkspaceForScope(scope, workspaceId);
  if (existingWorkspace) {
    return existingWorkspace;
  }

  const slug = normalizeWorkspaceSlug(workspaceId);

  const workspace = await prisma.workspace.create({
    data: {
      name: `Workspace ${slug}`,
      slug,
      scope: toDbScope(scope.scope),
      ownerId: scope.ownerId,
    },
    include: {
      selectedRepository: true,
    },
  });

  return attachScopeGitHubInstallation(scope, workspace);
}

export async function ensureDefaultWorkspaceForScope(scope: ActorScope) {
  const existingWorkspace = await prisma.workspace.findFirst({
    where: {
      scope: toDbScope(scope.scope),
      ownerId: scope.ownerId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      selectedRepository: true,
    },
  });

  if (existingWorkspace) {
    return attachScopeGitHubInstallation(scope, existingWorkspace);
  }

  const input = getDefaultWorkspaceInput(scope);
  const slug = await generateUniqueWorkspaceSlug(scope, input.slug);

  const workspace = await prisma.workspace.create({
    data: {
      name: input.name,
      slug,
      scope: toDbScope(scope.scope),
      ownerId: scope.ownerId,
    },
    include: {
      selectedRepository: true,
    },
  });

  return attachScopeGitHubInstallation(scope, workspace);
}

export async function createWorkspaceForScope(
  scope: ActorScope,
  input: { name: string }
) {
  const name = input.name.trim();
  const slug = await generateUniqueWorkspaceSlug(scope, name);

  return prisma.workspace.create({
    data: {
      name,
      slug,
      scope: toDbScope(scope.scope),
      ownerId: scope.ownerId,
    },
  });
}
