import type { GitHubRepository } from "@prisma/client";

import {
  createRepositoryFile,
  readRepositoryFileContentOptional,
  writeRepositoryFile,
} from "@/lib/github/repository-write";
import {
  parseTokencraftConfig,
  serializeTokencraftConfig,
  TOKENCRAFT_CONFIG_FILENAME,
} from "@/lib/tokencraft/config";

export async function readTokencraftConfigFromRepository(
  accessToken: string,
  repository: GitHubRepository,
  branch: string
) {
  const file = await readRepositoryFileContentOptional({
    accessToken,
    repository,
    path: TOKENCRAFT_CONFIG_FILENAME,
    branch,
  });

  if (!file) {
    return null;
  }

  return parseTokencraftConfig(file.content);
}

export async function writeTokencraftConfigToRepository(
  accessToken: string,
  repository: GitHubRepository,
  branch: string,
  files: string[]
) {
  const content = serializeTokencraftConfig(files);
  const existing = await readRepositoryFileContentOptional({
    accessToken,
    repository,
    path: TOKENCRAFT_CONFIG_FILENAME,
    branch,
  });

  const message = existing
    ? "chore(tokencraft): update tokencraft.config.json"
    : "chore(tokencraft): add tokencraft.config.json";

  if (existing) {
    await writeRepositoryFile({
      accessToken,
      repository,
      path: TOKENCRAFT_CONFIG_FILENAME,
      content,
      sha: existing.sha,
      message,
      branch,
    });
    return;
  }

  await createRepositoryFile({
    accessToken,
    repository,
    path: TOKENCRAFT_CONFIG_FILENAME,
    content,
    message,
    branch,
  });
}
