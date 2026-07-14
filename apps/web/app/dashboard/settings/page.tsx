import { redirect } from "next/navigation";

import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { GitHubAccountSettings } from "@/components/github-account-settings";
import { getGitHubStatusMessage } from "@/lib/github/status-messages";
import { getAuthSession } from "@/lib/auth/session";
import { getGitHubInstallationForScope } from "@/lib/workspaces/github-connection";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; github?: string }>;
}) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/auth/sign-in");
  }

  const { error: actionError, github: githubStatus } = await searchParams;
  const githubMessage = getGitHubStatusMessage(githubStatus);
  const githubInstallation = await getGitHubInstallationForScope(session.scope);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-8 py-8">
        <DashboardPageHeader
          title="Settings"
          titleClassName="text-2xl font-semibold"
        />

        {actionError ? (
          <p className="text-sm text-destructive">{actionError}</p>
        ) : null}

        {githubMessage ? (
          <p
            className={
              githubStatus === "connected"
                ? "text-sm text-foreground"
                : "text-sm text-destructive"
            }
          >
            {githubMessage}
          </p>
        ) : null}

        <GitHubAccountSettings githubInstallation={githubInstallation} />
      </div>
    </DashboardLayout>
  );
}
