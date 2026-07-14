"use client";

import { Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DisconnectGitHubForm({
  action,
  accountLogin,
  scope = "workspace",
}: {
  action: string;
  accountLogin?: string;
  scope?: "account" | "workspace";
}) {
  return (
    <form
      method="POST"
      action={action}
      onSubmit={(event) => {
        const accountLabel = accountLogin ? `@${accountLogin}` : "GitHub";
        const confirmed = window.confirm(
          scope === "account"
            ? `Disconnect ${accountLabel} from TokenCraft? All workspace repository selections and imported tokens in this scope will be removed.`
            : `Clear the repository selection for this workspace? Imported tokens for this workspace will be removed.`
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
        <Unplug size={16} />
        Disconnect
      </Button>
    </form>
  );
}
