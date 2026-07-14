"use client";

import { useRouter } from "next/navigation";
import {
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";

type TokenRepositoryActionButtonProps = {
  apiPath: string;
  body?: Record<string, string>;
  children: ReactNode;
} & Pick<ComponentProps<typeof Button>, "size" | "variant" | "className">;

async function readActionResponse(response: Response) {
  if (response.status === 401) {
    return { authRequired: true as const };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      error: `Request failed (${response.status}). Please try again.`,
    };
  }

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    return {
      error: payload?.error ?? "Something went wrong. Please try again.",
    };
  }

  return { ok: true as const };
}

function TokenRepositoryActionButton({
  apiPath,
  body,
  children,
  size,
  variant,
  className,
}: TokenRepositoryActionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={className}>
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const response = await fetch(apiPath, {
              method: "POST",
              credentials: "same-origin",
              headers: body
                ? { "Content-Type": "application/json" }
                : undefined,
              body: body ? JSON.stringify(body) : undefined,
            });

            const result = await readActionResponse(response);

            if ("authRequired" in result && result.authRequired) {
              router.push("/auth/sign-in");
              return;
            }

            if ("error" in result && result.error) {
              setError(result.error);
              return;
            }

            router.refresh();
          });
        }}
      >
        {children}
      </Button>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

type TokenRepositoryActionsProps = {
  workspaceId: string;
};

export function SyncRepositoriesButton({
  workspaceId,
  children,
}: TokenRepositoryActionsProps & { children: ReactNode }) {
  return (
    <TokenRepositoryActionButton
      apiPath={`/api/workspaces/${encodeURIComponent(workspaceId)}/repositories/sync`}
      size="sm"
      variant="outline"
    >
      {children}
    </TokenRepositoryActionButton>
  );
}

export function SelectRepositoryButton({
  workspaceId,
  repositoryId,
  children,
}: TokenRepositoryActionsProps & {
  repositoryId: string;
  children: ReactNode;
}) {
  return (
    <TokenRepositoryActionButton
      apiPath={`/api/workspaces/${encodeURIComponent(workspaceId)}/repositories/select`}
      body={{ repositoryId }}
      size="sm"
    >
      {children}
    </TokenRepositoryActionButton>
  );
}
