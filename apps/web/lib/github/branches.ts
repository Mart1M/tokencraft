import type { GitHubRepository } from "@prisma/client";

type GitHubBranchResponse = {
  name: string;
  commit: {
    sha: string;
  };
};

type GitHubRefResponse = {
  object: {
    sha: string;
  };
};

type GitHubCreateRefResponse = {
  ref: string;
};

async function requestGitHubJson<T>(accessToken: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GitHub branch request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function listRepositoryBranches(
  accessToken: string,
  repository: Pick<GitHubRepository, "owner" | "name">
) {
  const branches: GitHubBranchResponse[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const url = new URL(
      `https://api.github.com/repos/${repository.owner}/${repository.name}/branches`
    );
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", page.toString());

    const pageBranches = await requestGitHubJson<GitHubBranchResponse[]>(
      accessToken,
      url.toString()
    );

    branches.push(...pageBranches);

    if (pageBranches.length < 100) {
      break;
    }
  }

  return branches
    .map((branch) => ({
      name: branch.name,
      sha: branch.commit.sha,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function getRepositoryBranchSha(
  accessToken: string,
  repository: Pick<GitHubRepository, "owner" | "name">,
  branch: string
) {
  const url = new URL(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/git/ref/heads/${encodeURIComponent(branch)}`
  );

  const payload = await requestGitHubJson<GitHubRefResponse>(accessToken, url.toString());
  return payload.object.sha;
}

export async function createRepositoryBranch(
  accessToken: string,
  repository: Pick<GitHubRepository, "owner" | "name">,
  input: { name: string; fromBranch: string }
) {
  const sha = await getRepositoryBranchSha(accessToken, repository, input.fromBranch);
  const url = new URL(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/git/refs`
  );

  await requestGitHubJson<GitHubCreateRefResponse>(accessToken, url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: `refs/heads/${input.name}`,
      sha,
    }),
  });
}
