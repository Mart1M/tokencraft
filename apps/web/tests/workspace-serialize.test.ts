import type { GitHubInstallation, Workspace } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { serializeWorkspaceSummary } from "@/lib/workspaces/serialize";

describe("serializeWorkspaceSummary", () => {
  it("returns JSON-serializable data when GitHub installation uses BigInt fields", () => {
    const workspace = {
      id: "ws_1",
      name: "Personal workspace",
      slug: "workspace",
      scope: "USER",
      ownerId: "user_1",
      connectionStatus: "INSTALLATION_CONNECTED",
      selectedRepositoryId: null,
      activeBranch: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      githubInstallation: {
        id: "ghi_1",
        installationId: BigInt(12345),
        accountLogin: "acme",
        accountType: "USER",
        repositoryIds: [BigInt(1), BigInt(2)],
        scope: "USER",
        ownerId: "user_1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      } satisfies GitHubInstallation,
      selectedRepository: null,
    } satisfies Workspace & {
      githubInstallation: GitHubInstallation | null;
      selectedRepository: null;
    };

    const summary = serializeWorkspaceSummary(workspace, {
      hasScopeGitHubInstallation: true,
    });

    expect(() => JSON.stringify(summary)).not.toThrow();
    expect(summary).toEqual({
      id: "ws_1",
      name: "Personal workspace",
      slug: "workspace",
      connectionStatus: "INSTALLATION_CONNECTED",
      hasGitHubInstallation: true,
      hasSelectedRepository: false,
    });
  });
});
