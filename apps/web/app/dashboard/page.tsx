import { GitBranch, Settings, WalletCards } from "lucide-react";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { GitHubConnectionEmptyState } from "@/components/github-connection-empty-state";
import Link from "next/link";
import { getAuthSession } from "@/lib/auth/session";
import { getGitHubInstallationForScope } from "@/lib/workspaces/github-connection";
import { listWorkspacesForScope } from "@/lib/workspaces/service";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/auth/sign-in");
  }

  const firstName = session.user.name?.split(" ")[0];
  const [workspaces, githubInstallation] = await Promise.all([
    listWorkspacesForScope(session.scope),
    getGitHubInstallationForScope(session.scope),
  ]);
  const hasGitHubConnection = Boolean(githubInstallation);
  const workspaceWithRepository = workspaces.find((workspace) => workspace.selectedRepository);

  return (
    <DashboardLayout>
      <DashboardPageHeader title="Dashboard" />
      <div className="dashboard-content">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold">Welcome{firstName ? `, ${firstName}` : ""}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Current billing scope: {session.scope.scope === "organization" ? "organization" : "personal"}.
            </p>
          </div>
          {workspaceWithRepository ? (
            <Button asChild>
              <Link href={`/dashboard/workspaces/${workspaceWithRepository.slug}/tokens`}>
                Open token explorer
              </Link>
            </Button>
          ) : null}
        </div>

        {hasGitHubConnection ? (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Overview</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Item variant="muted">
                <ItemMedia variant="icon">
                  <GitBranch size={16} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>GitHub App</ItemTitle>
                  <ItemDescription>
                    Connected as {githubInstallation?.accountLogin}. Each workspace picks its own repository.
                  </ItemDescription>
                </ItemContent>
              </Item>
              <Item variant="muted">
                <ItemMedia variant="icon">
                  <WalletCards size={16} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Billing</ItemTitle>
                  <ItemDescription>
                    Stripe Checkout and webhooks are ready for Pro and Team plans.
                  </ItemDescription>
                </ItemContent>
              </Item>
              <Item variant="muted">
                <ItemMedia variant="icon">
                  <Settings size={16} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Workspace metadata</ItemTitle>
                  <ItemDescription>
                    Workspaces point to Git repositories, but token values are not persisted.
                  </ItemDescription>
                </ItemContent>
              </Item>
            </div>
          </div>
        ) : (
          <GitHubConnectionEmptyState />
        )}
      </div>
    </DashboardLayout>
  );
}
