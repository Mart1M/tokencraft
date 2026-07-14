import { redirect } from "next/navigation";

import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { GitHubConnectionEmptyState } from "@/components/github-connection-empty-state";
import { getAuthSession } from "@/lib/auth/session";
import { getGitHubInstallationForScope } from "@/lib/workspaces/github-connection";
import { listWorkspacesForScope } from "@/lib/workspaces/service";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/auth/sign-in");
  }

  const [workspaces, githubInstallation] = await Promise.all([
    listWorkspacesForScope(session.scope),
    getGitHubInstallationForScope(session.scope),
  ]);

  const workspaceWithRepository = workspaces.find((workspace) => workspace.selectedRepository);

  if (workspaceWithRepository) {
    redirect(`/dashboard/workspaces/${workspaceWithRepository.slug}/tokens`);
  }

  if (githubInstallation) {
    const firstWorkspace = workspaces[0];
    if (firstWorkspace) {
      redirect(`/dashboard/workspaces/${firstWorkspace.slug}/settings`);
    }
  }

  return (
    <DashboardLayout>
      <DashboardPageHeader title="Tokens" />
      <div className="dashboard-content-compact">
        <GitHubConnectionEmptyState />
      </div>
    </DashboardLayout>
  );
}
