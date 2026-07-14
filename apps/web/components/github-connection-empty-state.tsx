import { GitBranch, Github } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type GitHubConnectionEmptyStateProps = {
  workspaceId?: string;
  title?: string;
  description?: string;
  variant?: "account" | "workspace";
};

export function GitHubConnectionEmptyState({
  workspaceId,
  title,
  description,
  variant = "account",
}: GitHubConnectionEmptyStateProps) {
  const accountSettingsHref = "/dashboard/settings";
  const workspaceSettingsHref = workspaceId
    ? `/dashboard/workspaces/${encodeURIComponent(workspaceId)}/settings`
    : accountSettingsHref;

  if (variant === "workspace") {
    return (
      <div className="empty-state-card">
        <div className="empty-state-icon">
          <GitBranch size={24} />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {title ?? "Select a repository"}
        </h2>
        <p className="empty-state-description">
          {description ??
            "This workspace needs a GitHub repository before you can browse collections or edit token files."}
        </p>
        <div className="empty-state-actions">
          <Button asChild>
            <Link href={workspaceSettingsHref}>
              <GitBranch size={16} />
              Workspace settings
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={accountSettingsHref}>
              <Github size={16} />
              GitHub settings
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-state-card">
      <div className="empty-state-icon">
        <Github size={24} />
      </div>
      <h2 className="text-xl font-semibold text-foreground">
        {title ?? "Connect GitHub to start"}
      </h2>
      <p className="empty-state-description">
        {description ??
          "Connect the GitHub App once for your account. Each workspace can then pick its own repository."}
      </p>
      <div className="empty-state-actions">
        <Button asChild>
          <a href="/api/github/connect">
            <Github size={16} />
            Connect GitHub
          </a>
        </Button>
        {workspaceId ? (
          <Button variant="outline" asChild>
            <Link href={workspaceSettingsHref}>
              <GitBranch size={16} />
              Workspace settings
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
