import type { GitHubRepository } from "@prisma/client";

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

type GitHubWriteFileResponse = {
  content: {
    sha: string;
  };
};

export async function writeRepositoryFile({
  accessToken,
  repository,
  path,
  content,
  sha,
  message,
  branch,
}: {
  accessToken: string;
  repository: GitHubRepository;
  path: string;
  content: string;
  sha: string;
  message: string;
  branch: string;
}) {
  const url = new URL(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${encodePath(path)}`
  );

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      sha,
      branch,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GitHub file write failed with ${response.status}.`);
  }

  return (await response.json()) as GitHubWriteFileResponse;
}

type GitHubContentFileResponse = {
  sha: string;
  content: string;
};

export async function readRepositoryFileContent({
  accessToken,
  repository,
  path,
  branch,
}: {
  accessToken: string;
  repository: GitHubRepository;
  path: string;
  branch: string;
}) {
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
    throw new Error(`GitHub file read failed with ${response.status}.`);
  }

  const payload = (await response.json()) as GitHubContentFileResponse;

  return {
    sha: payload.sha,
    content: Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8"),
  };
}

export async function readRepositoryFileContentOptional({
  accessToken,
  repository,
  path,
  branch,
}: {
  accessToken: string;
  repository: GitHubRepository;
  path: string;
  branch: string;
}) {
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

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub file read failed with ${response.status}.`);
  }

  const payload = (await response.json()) as GitHubContentFileResponse;

  return {
    sha: payload.sha,
    content: Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8"),
  };
}

export async function createRepositoryFile({
  accessToken,
  repository,
  path,
  content,
  message,
  branch,
}: {
  accessToken: string;
  repository: GitHubRepository;
  path: string;
  content: string;
  message: string;
  branch: string;
}) {
  const url = new URL(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${encodePath(path)}`
  );

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GitHub file create failed with ${response.status}.`);
  }

  return (await response.json()) as GitHubWriteFileResponse;
}

type GitHubContentMetaResponse = {
  sha: string;
};

export async function getRepositoryFileSha({
  accessToken,
  repository,
  path,
  branch,
}: {
  accessToken: string;
  repository: GitHubRepository;
  path: string;
  branch: string;
}) {
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
    throw new Error(`GitHub file lookup failed with ${response.status}.`);
  }

  const payload = (await response.json()) as GitHubContentMetaResponse;
  return payload.sha;
}

export async function deleteRepositoryFile({
  accessToken,
  repository,
  path,
  sha,
  message,
  branch,
}: {
  accessToken: string;
  repository: GitHubRepository;
  path: string;
  sha: string;
  message: string;
  branch: string;
}) {
  const url = new URL(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${encodePath(path)}`
  );

  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message,
      sha,
      branch,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GitHub file delete failed with ${response.status}.`);
  }
}
