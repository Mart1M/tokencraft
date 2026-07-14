import { prisma } from "@/lib/db/prisma";
import type { ActorScope } from "@/lib/auth/scope";
import { createInstallationAccessToken } from "@/lib/github/app";
import { createRepositoryBranch, listRepositoryBranches } from "@/lib/github/branches";
import { inspectTokenJson } from "@/lib/github/token-scan";
import {
  getWorkspaceActiveBranch,
  isValidBranchName,
} from "@/lib/workspaces/branch";
import { getWorkspaceTokenExplorer } from "@/lib/workspaces/service";
import { TokenOperationError } from "@/lib/workspaces/token-operations";

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function requireBranchWorkspace(scope: ActorScope, workspaceId: string) {
  const workspace = await getWorkspaceTokenExplorer(scope, workspaceId);

  if (!workspace) {
    throw new TokenOperationError("Workspace not found.", 404);
  }

  if (!workspace.selectedRepository) {
    throw new TokenOperationError("Select a repository before managing branches.", 400);
  }

  if (!workspace.githubInstallation) {
    throw new TokenOperationError("GitHub installation is required.", 400);
  }

  return workspace;
}

async function readRepositoryFileAtBranch(
  accessToken: string,
  repository: NonNullable<
    Awaited<ReturnType<typeof requireBranchWorkspace>>["selectedRepository"]
  >,
  path: string,
  branch: string
) {
  const url = new URL(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${encodePath(path)}`
  );
  url.searchParams.set("ref", branch);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new TokenOperationError(`Unable to read ${path} from branch ${branch}.`, 502);
  }

  const payload = (await response.json()) as {
    sha: string;
    content: string;
  };

  return {
    sha: payload.sha,
    content: Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8"),
  };
}

async function refreshWorkspaceTokenFiles(
  workspace: Awaited<ReturnType<typeof requireBranchWorkspace>>,
  branch: string
) {
  const repository = workspace.selectedRepository!;
  const { token } = await createInstallationAccessToken(
    workspace.githubInstallation!.installationId.toString()
  );

  for (const tokenFile of workspace.tokenFiles) {
    const remoteFile = await readRepositoryFileAtBranch(
      token,
      repository,
      tokenFile.path,
      branch
    );
    const inspection = inspectTokenJson(tokenFile.path, remoteFile.content);

    await prisma.tokenFile.update({
      where: { id: tokenFile.id },
      data: {
        sha: remoteFile.sha,
        collectionName: inspection.collectionName,
        format: inspection.format,
        tokenCount: inspection.tokenCount,
        metadata: inspection.metadata,
      },
    });
  }
}

export async function listWorkspaceRepositoryBranches(
  scope: ActorScope,
  workspaceId: string
) {
  const workspace = await requireBranchWorkspace(scope, workspaceId);
  const repository = workspace.selectedRepository!;
  const currentBranch = getWorkspaceActiveBranch(workspace);

  const { token } = await createInstallationAccessToken(
    workspace.githubInstallation!.installationId.toString()
  );

  const branches = await listRepositoryBranches(token, repository);

  return {
    branches: branches.map((branch) => branch.name),
    currentBranch,
    defaultBranch: repository.defaultBranch,
  };
}

export async function switchWorkspaceBranch(
  scope: ActorScope,
  workspaceId: string,
  branch: string
) {
  const workspace = await requireBranchWorkspace(scope, workspaceId);
  const repository = workspace.selectedRepository!;
  const trimmedBranch = branch.trim();
  const currentBranch = getWorkspaceActiveBranch(workspace);

  if (!trimmedBranch) {
    throw new TokenOperationError("Branch name is required.", 400);
  }

  if (trimmedBranch === currentBranch) {
    return {
      branch: currentBranch,
      workspaceSlug: workspace.slug,
    };
  }

  const { token } = await createInstallationAccessToken(
    workspace.githubInstallation!.installationId.toString()
  );

  const branches = await listRepositoryBranches(token, repository);

  if (!branches.some((item) => item.name === trimmedBranch)) {
    throw new TokenOperationError(`Branch "${trimmedBranch}" was not found.`, 404);
  }

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { activeBranch: trimmedBranch },
  });

  if (workspace.tokenFiles.length > 0) {
    await refreshWorkspaceTokenFiles(
      {
        ...workspace,
        activeBranch: trimmedBranch,
      },
      trimmedBranch
    );
  }

  return {
    branch: trimmedBranch,
    workspaceSlug: workspace.slug,
  };
}

export async function createWorkspaceBranch(
  scope: ActorScope,
  workspaceId: string,
  input: { name: string; fromBranch?: string }
) {
  const workspace = await requireBranchWorkspace(scope, workspaceId);
  const repository = workspace.selectedRepository!;
  const branchName = input.name.trim();
  const fromBranch = input.fromBranch?.trim() || getWorkspaceActiveBranch(workspace);

  if (!isValidBranchName(branchName)) {
    throw new TokenOperationError("Enter a valid branch name.", 400);
  }

  const { token } = await createInstallationAccessToken(
    workspace.githubInstallation!.installationId.toString()
  );

  const existingBranches = await listRepositoryBranches(token, repository);

  if (existingBranches.some((branch) => branch.name === branchName)) {
    throw new TokenOperationError(`Branch "${branchName}" already exists.`, 409);
  }

  if (!existingBranches.some((branch) => branch.name === fromBranch)) {
    throw new TokenOperationError(`Base branch "${fromBranch}" was not found.`, 404);
  }

  await createRepositoryBranch(token, repository, {
    name: branchName,
    fromBranch,
  });

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { activeBranch: branchName },
  });

  if (workspace.tokenFiles.length > 0) {
    await refreshWorkspaceTokenFiles(
      {
        ...workspace,
        activeBranch: branchName,
      },
      branchName
    );
  }

  return {
    branch: branchName,
    workspaceSlug: workspace.slug,
  };
}
