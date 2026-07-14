import { Github, RefreshCw } from "lucide-react";
import Link from "next/link";

import { DisconnectGitHubForm } from "@/components/disconnect-github-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GitHubInstallation, GitHubRepository } from "@prisma/client";

type GitHubInstallationWithRepositories = GitHubInstallation & {
  repositories: GitHubRepository[];
};

export function GitHubAccountSettings({
  githubInstallation,
}: {
  githubInstallation: GitHubInstallationWithRepositories | null;
}) {
  if (!githubInstallation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github size={18} />
            GitHub
          </CardTitle>
          <CardDescription>
            Connect the GitHub App once for your account. Every workspace can then pick its own
            repository.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <a href="/api/github/connect">
              <Github size={16} />
              Connect GitHub
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const repositories = githubInstallation.repositories;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Github size={18} />
              GitHub
            </CardTitle>
            <CardDescription>
              Connected as{" "}
              <span className="font-mono text-foreground">{githubInstallation.accountLogin}</span>.
              Repositories are shared across all workspaces in this scope.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form method="POST" action="/api/github/repositories/sync">
              <Button type="submit" variant="outline" size="sm">
                <RefreshCw size={14} />
                Refresh repos
              </Button>
            </form>
            <DisconnectGitHubForm
              action="/api/github/disconnect"
              accountLogin={githubInstallation.accountLogin}
              scope="account"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {repositories.length
            ? `${repositories.length} repositor${repositories.length === 1 ? "y" : "ies"} available.`
            : "No repositories synced yet. Refresh after installing the GitHub App on additional repos."}
        </p>
        {repositories.length ? (
          <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border">
            {repositories.map((repository) => (
              <li key={repository.id} className="px-3 py-2.5">
                <Link
                  href={repository.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-mono text-sm hover:underline"
                >
                  {repository.fullName}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
