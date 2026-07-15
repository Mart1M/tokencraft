import { createTokenFile, WorkspaceFsError } from "@/lib/tokens/fs";

export class CollectionOperationError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "CollectionOperationError";
  }
}

function deriveCollectionPath(input: { path?: string; collectionName?: string }) {
  if (input.path?.trim()) {
    return input.path.trim();
  }

  const name = input.collectionName?.trim();

  if (!name) {
    throw new CollectionOperationError("A path or collection name is required.");
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "collection"}.tokens.json`;
}

export async function createWorkspaceCollection(
  rootPath: string,
  input: { path?: string; collectionName?: string }
) {
  const relativePath = deriveCollectionPath(input);

  try {
    return await createTokenFile(rootPath, relativePath, input.collectionName);
  } catch (error) {
    if (error instanceof WorkspaceFsError) {
      throw new CollectionOperationError(error.message, error.status);
    }

    throw error;
  }
}
