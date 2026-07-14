import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { RepositoryFileBrowser } from "@/components/repository-file-browser";
import { WorkspaceRepositorySettings } from "@/components/workspace-repository-settings";
import { getAuthSession } from "@/lib/auth/session";
import { getGitHubInstallationForScope } from "@/lib/workspaces/github-connection";
import { getWorkspaceTokenExplorer } from "@/lib/workspaces/service";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspaceId } = await params;
  const { error: actionError } = await searchParams;
  const session = await getAuthSession();

  if (!session) {
    redirect("/auth/sign-in");
  }

  const [workspace, githubInstallation] = await Promise.all([
    getWorkspaceTokenExplorer(session.scope, workspaceId),
    getGitHubInstallationForScope(session.scope),
  ]);

  if (!workspace) {
    redirect("/dashboard");
  }

  const repositories = githubInstallation?.repositories ?? [];

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-8 py-8">
        <DashboardPageHeader
          title="Workspace settings"
          titleClassName="text-2xl font-semibold"
        />

        {actionError ? (
          <p className="text-sm text-destructive">{actionError}</p>
        ) : null}

        <WorkspaceRepositorySettings
          workspaceSlug={workspace.slug}
          repositories={repositories}
          selectedRepository={workspace.selectedRepository}
          hasScopeGitHub={Boolean(githubInstallation)}
        />

        {workspace.selectedRepository ? (
          <section className="space-y-3 border-t pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium">Token files</h2>
              <Link
                href={`/dashboard/workspaces/${encodeURIComponent(workspace.slug)}/tokens`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Open explorer
              </Link>
            </div>
            <RepositoryFileBrowser workspaceId={workspace.slug} />
          </section>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
