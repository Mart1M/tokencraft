import { prisma } from "@/lib/db/prisma";
import { syncInstallationRepositories } from "@/lib/github/repositories";
import {
  importRepositoryTokenFiles,
  listRepositoryJsonFiles
} from "@/lib/github/repository-files";
import { readTokencraftConfigFromRepository } from "@/lib/github/tokencraft-config";
import { createInstallationAccessToken } from "@/lib/github/app";
import { scanRepositoryTokenFiles } from "@/lib/github/token-scan";
import { getWorkspaceActiveBranch } from "@/lib/workspaces/branch";
import {
  clearWorkspaceRepositorySelection,
  getGitHubInstallationForScope,
  unlinkGitHubInstallationFromScope,
} from "@/lib/workspaces/github-connection";
import { getWorkspaceTokenExplorer } from "@/lib/workspaces/service";
import type { ActorScope } from "@/lib/auth/scope";

export class TokenOperationError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "TokenOperationError";
  }
}

async function requireWorkspace(scope: ActorScope, workspaceId: string) {
  const workspace = await getWorkspaceTokenExplorer(scope, workspaceId);
  if (!workspace) {
    throw new TokenOperationError("Workspace not found.", 404);
  }

  return workspace;
}

async function autoImportFromTokencraftConfig(scope: ActorScope, workspaceId: string) {
  const workspace = await requireWorkspace(scope, workspaceId);

  if (!workspace.selectedRepository || !workspace.githubInstallation) {
    return {
      configFound: false,
      autoImported: false,
      importedFileCount: 0,
      configFiles: [] as string[]
    };
  }

  const branch = getWorkspaceActiveBranch(workspace);
  const { token } = await createInstallationAccessToken(
    workspace.githubInstallation.installationId.toString()
  );

  const config = await readTokencraftConfigFromRepository(
    token,
    workspace.selectedRepository,
    branch
  );

  if (!config?.files.length) {
    return {
      configFound: false,
      autoImported: false,
      importedFileCount: 0,
      configFiles: [] as string[]
    };
  }

  if (workspace.tokenFiles.length > 0) {
    return {
      configFound: true,
      autoImported: false,
      importedFileCount: 0,
      configFiles: config.files
    };
  }

  const result = await importRepositoryTokenFiles({
    workspaceId: workspace.id,
    repositoryId: workspace.selectedRepository.id,
    paths: config.files,
    branch,
    syncConfig: false
  });

  return {
    configFound: true,
    autoImported: result.importedFileCount > 0,
    importedFileCount: result.importedFileCount,
    configFiles: config.files
  };
}

export async function syncScopeRepositories(scope: ActorScope) {
  const githubInstallation = await getGitHubInstallationForScope(scope);

  if (!githubInstallation) {
    throw new TokenOperationError("GitHub installation is required.", 400);
  }

  await syncInstallationRepositories(githubInstallation);

  return { synced: true };
}

export async function syncWorkspaceRepositories(scope: ActorScope, workspaceId: string) {
  const workspace = await requireWorkspace(scope, workspaceId);
  await syncScopeRepositories(scope);

  return { workspaceSlug: workspace.slug };
}

export async function selectWorkspaceRepository(
  scope: ActorScope,
  workspaceId: string,
  repositoryId: string
) {
  const workspace = await requireWorkspace(scope, workspaceId);

  if (!workspace.githubInstallation) {
    throw new TokenOperationError("GitHub installation is required.", 400);
  }

  const repository = await prisma.gitHubRepository.findFirst({
    where: {
      id: repositoryId,
      installationId: workspace.githubInstallation.id
    }
  });

  if (!repository) {
    throw new TokenOperationError("Repository not found for this GitHub installation.", 404);
  }

  const repositoryChanged = workspace.selectedRepositoryId !== repository.id;

  if (repositoryChanged) {
    await prisma.tokenFile.deleteMany({
      where: { workspaceId: workspace.id }
    });
  }

  await prisma.workspace.update({
    where: {
      id: workspace.id
    },
    data: {
      selectedRepository: { connect: { id: repository.id } },
      activeBranch: null,
      connectionStatus: "REPOSITORY_SELECTED"
    }
  });

  const autoImport = await autoImportFromTokencraftConfig(scope, workspaceId);

  return {
    workspaceSlug: workspace.slug,
    autoImported: autoImport.autoImported,
    importedFileCount: autoImport.importedFileCount,
    configFound: autoImport.configFound
  };
}

export async function listWorkspaceRepositoryJsonFiles(scope: ActorScope, workspaceId: string) {
  const workspace = await requireWorkspace(scope, workspaceId);

  if (!workspace.selectedRepository) {
    throw new TokenOperationError("Select a repository before browsing files.", 400);
  }

  if (!workspace.githubInstallation) {
    throw new TokenOperationError("GitHub installation is required.", 400);
  }

  const branch = getWorkspaceActiveBranch(workspace);
  const files = await listRepositoryJsonFiles(workspace.selectedRepository, branch);

  const { token } = await createInstallationAccessToken(
    workspace.githubInstallation.installationId.toString()
  );

  const config = await readTokencraftConfigFromRepository(
    token,
    workspace.selectedRepository,
    branch
  );

  return {
    workspaceSlug: workspace.slug,
    files,
    importedPaths: workspace.tokenFiles.map((file) => file.path),
    tokencraftConfig: config
      ? { found: true as const, files: config.files }
      : { found: false as const }
  };
}

export async function importWorkspaceRepositoryTokenFiles(
  scope: ActorScope,
  workspaceId: string,
  paths: string[]
) {
  const workspace = await requireWorkspace(scope, workspaceId);

  if (!workspace.selectedRepository) {
    throw new TokenOperationError("Select a repository before importing files.", 400);
  }

  try {
    const result = await importRepositoryTokenFiles({
      workspaceId: workspace.id,
      repositoryId: workspace.selectedRepository.id,
      paths,
      branch: getWorkspaceActiveBranch(workspace),
      syncConfig: true
    });

    return { workspaceSlug: workspace.slug, ...result };
  } catch (error) {
    throw new TokenOperationError(
      error instanceof Error ? error.message : "Failed to import token files.",
      400
    );
  }
}

export async function scanWorkspaceRepository(scope: ActorScope, workspaceId: string) {
  const workspace = await requireWorkspace(scope, workspaceId);

  if (!workspace.selectedRepository) {
    throw new TokenOperationError("Select a repository before scanning.", 400);
  }

  try {
    await scanRepositoryTokenFiles({
      workspaceId: workspace.id,
      repositoryId: workspace.selectedRepository.id
    });
  } catch {
    // Scan failures are persisted on TokenScan.
  }

  return { workspaceSlug: workspace.slug };
}

export async function disconnectScopeGitHub(scope: ActorScope) {
  const githubInstallation = await getGitHubInstallationForScope(scope);

  if (!githubInstallation) {
    throw new TokenOperationError("GitHub is not connected.", 400);
  }

  await unlinkGitHubInstallationFromScope(scope);

  return { disconnected: true };
}

export async function clearWorkspaceRepository(scope: ActorScope, workspaceId: string) {
  const workspace = await requireWorkspace(scope, workspaceId);

  if (!workspace.selectedRepository) {
    throw new TokenOperationError("This workspace has no repository selected.", 400);
  }

  await clearWorkspaceRepositorySelection(workspace.id);

  return { workspaceSlug: workspace.slug };
}

export async function disconnectWorkspaceGitHub(scope: ActorScope, workspaceId: string) {
  return clearWorkspaceRepository(scope, workspaceId);
}
