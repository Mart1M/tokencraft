import type { WorkspaceScope } from "@tokencraft/core";
import type { WorkspaceScope as DbWorkspaceScope } from "@prisma/client";

export interface ActorScope {
  scope: WorkspaceScope;
  ownerId: string;
}

export function resolveActorScope({
  userId,
  orgId
}: {
  userId: string;
  orgId?: string | null;
}): ActorScope {
  if (orgId) {
    return { scope: "organization", ownerId: orgId };
  }

  return { scope: "user", ownerId: userId };
}

export function toDbScope(scope: WorkspaceScope): DbWorkspaceScope {
  return scope === "organization" ? "ORGANIZATION" : "USER";
}
