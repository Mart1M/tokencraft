import { ExternalLink, GitBranch } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GitHubRepository } from "@prisma/client";

export function WorkspaceRepositorySettings({
  workspaceSlug,
  repositories,
  selectedRepository,
  hasScopeGitHub,
}: {
  workspaceSlug: string;
  repositories: GitHubRepository[];
  selectedRepository: GitHubRepository | null;
  hasScopeGitHub: boolean;
}) {
  if (!hasScopeGitHub) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch size={18} />
            Repository
          </CardTitle>
          <CardDescription>
            Connect GitHub at the account level before selecting a repository for this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/settings">Open GitHub settings</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch size={18} />
              Repository
            </CardTitle>
            <CardDescription>
              Choose which GitHub repository this workspace reads token files from.
            </CardDescription>
          </div>
          {selectedRepository ? (
            <form
              method="POST"
              action={`/api/workspaces/${encodeURIComponent(workspaceSlug)}/repositories/clear`}
            >
              <Button type="submit" variant="ghost" size="sm">
                Clear selection
              </Button>
            </form>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {selectedRepository ? (
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Selected
            </p>
            <Link
              href={selectedRepository.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm hover:underline"
            >
              {selectedRepository.fullName}
              <ExternalLink size={14} className="text-muted-foreground" />
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No repository selected yet. Pick one from the list below.
          </p>
        )}

        {repositories.length ? (
          <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
            {repositories.map((repository) => {
              const isSelected = selectedRepository?.id === repository.id;

              return (
                <li
                  key={repository.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <Link
                    href={repository.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-mono text-sm hover:underline"
                  >
                    {repository.fullName}
                  </Link>
                  {isSelected ? (
                    <span className="shrink-0 text-xs text-muted-foreground">Selected</span>
                  ) : (
                    <form
                      method="POST"
                      action={`/api/workspaces/${encodeURIComponent(workspaceSlug)}/repositories/select`}
                    >
                      <input type="hidden" name="repositoryId" value={repository.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Select
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No repositories available.{" "}
            <Link href="/dashboard/settings" className="underline underline-offset-4">
              Refresh repositories
            </Link>{" "}
            in GitHub settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
