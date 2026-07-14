-- Migrate GitHubInstallation from workspace-scoped to account/org-scoped.
-- Run this once before `pnpm db:generate` / `prisma db push` if you have existing data.

ALTER TABLE "GitHubInstallation" ADD COLUMN IF NOT EXISTS "scope" "WorkspaceScope";
ALTER TABLE "GitHubInstallation" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

UPDATE "GitHubInstallation" AS gi
SET "scope" = w."scope",
    "ownerId" = w."ownerId"
FROM "Workspace" AS w
WHERE gi."workspaceId" = w."id"
  AND gi."scope" IS NULL;

ALTER TABLE "GitHubInstallation" DROP CONSTRAINT IF EXISTS "GitHubInstallation_workspaceId_fkey";
ALTER TABLE "GitHubInstallation" DROP COLUMN IF EXISTS "workspaceId";

ALTER TABLE "GitHubInstallation" ALTER COLUMN "scope" SET NOT NULL;
ALTER TABLE "GitHubInstallation" ALTER COLUMN "ownerId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "GitHubInstallation_scope_ownerId_key"
  ON "GitHubInstallation"("scope", "ownerId");
