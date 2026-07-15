import { buildStoredTokenEntry } from "@/lib/tokens/display";
import { formatDraftValue, type TokenDraft } from "@/lib/tokens/draft-utils";
import { formatDtcgTokenValue } from "@/lib/tokens/dtcg-format";
import type { TokenFileMetadata } from "@/lib/tokens/flatten";
import { buildRawValueFromDraftInput } from "@/lib/tokens/serialize";
import { mergeTokenMetadata } from "@/lib/tokens/token-metadata";

export class TokenEditError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "TokenEditError";
  }
}

function ensureTopLevelKey(metadata: TokenFileMetadata, path: string) {
  const topLevelKey = path.split(".")[0];

  if (!topLevelKey || metadata.topLevelKeys.includes(topLevelKey)) {
    return metadata.topLevelKeys;
  }

  return [...metadata.topLevelKeys, topLevelKey];
}

export function applyDraftsToMetadata(
  metadata: TokenFileMetadata,
  drafts: TokenDraft[]
): TokenFileMetadata {
  let tokens = [...metadata.tokens];
  let topLevelKeys = [...metadata.topLevelKeys];

  for (const draft of drafts) {
    const operation = draft.operation ?? "update";

    if (operation === "delete") {
      tokens = tokens.filter((entry) => entry.path !== draft.path);
      continue;
    }

    const formatted = formatDraftValue(draft);
    const index = tokens.findIndex((entry) => entry.path === draft.path);

    if (operation === "create") {
      if (index !== -1) {
        throw new TokenEditError(`Token "${draft.path}" already exists.`, 409);
      }

      topLevelKeys = ensureTopLevelKey({ ...metadata, topLevelKeys, tokens }, draft.path);
      const rawValue = buildRawValueFromDraftInput(
        {
          path: draft.path,
          value: formatDtcgTokenValue(formatted, draft.type),
          ...(draft.type ? { type: draft.type } : {}),
        },
        formatted,
        draft.mode
      );

      tokens.push(
        mergeTokenMetadata(
          buildStoredTokenEntry(draft.path, draft.type, rawValue),
          draft
        )
      );
      continue;
    }

    if (index === -1) {
      continue;
    }

    const current = tokens[index];
    const rawValue = buildRawValueFromDraftInput(current, formatted, draft.mode);

    tokens[index] = mergeTokenMetadata(
      buildStoredTokenEntry(current.path, current.type, rawValue),
      draft,
      current
    );
  }

  return {
    ...metadata,
    topLevelKeys,
    tokens,
  };
}
