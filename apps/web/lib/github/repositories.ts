import type { GitHubInstallation, GitHubRepository } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { createInstallationAccessToken } from "@/lib/github/app";

type GitHubRepositoryResponse = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string | null;
  html_url: string;
  owner: {
    login: string;
  };
};

type InstallationRepositoriesResponse = {
  repositories: GitHubRepositoryResponse[];
};

async function requestInstallationJson<T>(installationId: string | number, url: string) {
  const { token } = await createInstallationAccessToken(installationId);
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function listInstallationRepositories(installationId: string | number) {
  const repositories: GitHubRepositoryResponse[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const url = new URL("https://api.github.com/installation/repositories");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", page.toString());

    const payload = await requestInstallationJson<InstallationRepositoriesResponse>(
      installationId,
      url.toString()
    );

    repositories.push(...payload.repositories);

    if (payload.repositories.length < 100) {
      break;
    }
  }

  return repositories;
}

export async function syncInstallationRepositories(
  installation: Pick<GitHubInstallation, "id" | "installationId">
) {
  const repositories = await listInstallationRepositories(installation.installationId.toString());

  await prisma.$transaction([
    ...repositories.map((repository) =>
      prisma.gitHubRepository.upsert({
        where: {
          repositoryId: BigInt(repository.id)
        },
        create: {
          repositoryId: BigInt(repository.id),
          installationId: installation.id,
          owner: repository.owner.login,
          name: repository.name,
          fullName: repository.full_name,
          defaultBranch: repository.default_branch ?? "main",
          private: repository.private,
          htmlUrl: repository.html_url
        },
        update: {
          installationId: installation.id,
          owner: repository.owner.login,
          name: repository.name,
          fullName: repository.full_name,
          defaultBranch: repository.default_branch ?? "main",
          private: repository.private,
          htmlUrl: repository.html_url
        }
      })
    ),
    prisma.gitHubInstallation.update({
      where: {
        id: installation.id
      },
      data: {
        repositoryIds: repositories.map((repository) => BigInt(repository.id))
      }
    })
  ]);

  return prisma.gitHubRepository.findMany({
    where: {
      installationId: installation.id
    },
    orderBy: {
      fullName: "asc"
    }
  });
}

export type SyncedGitHubRepository = GitHubRepository;
