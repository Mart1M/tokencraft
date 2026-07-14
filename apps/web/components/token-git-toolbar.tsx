"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  GitBranch,
  GitCommitHorizontal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranchModal } from "@/components/git-branch-modal";
import { GitCommitModal } from "@/components/git-commit-modal";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";

export function TokenGitToolbar({
  workspaceId,
  branch,
  initialRemoteChanges,
}: {
  workspaceId: string;
  branch: string;
  initialRemoteChanges: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [commitMessage, setCommitMessage] = useState("Update design tokens");
  const [error, setError] = useState<string | null>(null);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [activeBranch, setActiveBranch] = useState(branch);

  const drafts = useTokenDraftStore((state) => state.drafts);
  const pendingCollectionDeletes = useTokenDraftStore(
    (state) => state.pendingCollectionDeletes,
  );
  const pendingLocalCollectionIds = useTokenDraftStore(
    (state) => state.pendingLocalCollectionIds,
  );
  const hasLocalEdits = useTokenDraftStore((state) => state.hasLocalEdits());
  const pendingPushCommitCount = useTokenDraftStore(
    (state) => state.pendingPushCommitCount,
  );
  const hasRemoteChanges = useTokenDraftStore(
    (state) => state.hasRemoteChanges,
  );
  const setHasRemoteChanges = useTokenDraftStore(
    (state) => state.setHasRemoteChanges,
  );
  const setPendingPushFileIds = useTokenDraftStore(
    (state) => state.setPendingPushFileIds,
  );
  const pendingPushFileIds = useTokenDraftStore(
    (state) => state.pendingPushFileIds,
  );
  const incrementPendingPushCommitCount = useTokenDraftStore(
    (state) => state.incrementPendingPushCommitCount,
  );
  const resetPendingPushCommitCount = useTokenDraftStore(
    (state) => state.resetPendingPushCommitCount,
  );
  const resetGitState = useTokenDraftStore((state) => state.resetGitState);
  const clearAllDrafts = useTokenDraftStore((state) => state.clearAllDrafts);
  const clearPendingLocalCollections = useTokenDraftStore(
    (state) => state.clearPendingLocalCollections,
  );

  const hasUnpushedCommits = pendingPushCommitCount > 0;

  useEffect(() => {
    setActiveBranch(branch);
  }, [branch]);
  const apiBase = `/api/workspaces/${encodeURIComponent(workspaceId)}/tokens`;

  useEffect(() => {
    setHasRemoteChanges(initialRemoteChanges);
  }, [initialRemoteChanges, setHasRemoteChanges]);

  useEffect(() => {
    let cancelled = false;

    async function refreshSyncStatus() {
      const response = await fetch(`${apiBase}/sync-status`, {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok || cancelled) {
        return;
      }

      const payload = (await response.json()) as { behind?: boolean };
      setHasRemoteChanges(Boolean(payload.behind));
    }

    void refreshSyncStatus();

    return () => {
      cancelled = true;
    };
  }, [apiBase, setHasRemoteChanges]);

  function runAction(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Git action failed.",
        );
      }
    });
  }

  function commitChanges() {
    runAction(async () => {
      const draftValues = Object.values(drafts);
      const response = await fetch(`${apiBase}/commit`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: commitMessage,
          drafts: draftValues,
          pendingCollectionDeletes,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Commit failed.");
      }

      const affectedFileIds = [
        ...draftValues.map((draft) => draft.fileId),
        ...pendingCollectionDeletes,
        ...pendingLocalCollectionIds,
      ];

      clearAllDrafts();
      clearPendingLocalCollections();
      setPendingPushFileIds([
        ...new Set([...pendingPushFileIds, ...affectedFileIds]),
      ]);
      incrementPendingPushCommitCount();
      setShowCommitModal(false);
    });
  }

  function pullChanges() {
    runAction(async () => {
      const response = await fetch(`${apiBase}/pull`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Pull failed.");
      }

      clearAllDrafts();
      setHasRemoteChanges(false);
      resetPendingPushCommitCount();
      setPendingPushFileIds([]);
    });
  }

  function pushChanges() {
    runAction(async () => {
      const response = await fetch(`${apiBase}/push`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Push design token updates",
          fileIds: pendingPushFileIds,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Push failed.");
      }

      resetPendingPushCommitCount();
      setHasRemoteChanges(false);
      setPendingPushFileIds([]);
      clearPendingLocalCollections();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          className="gap-1.5 font-mono text-xs"
          onClick={() => setShowBranchModal(true)}
        >
          <GitBranch size={14} />
          {activeBranch}
        </Button>
        {hasRemoteChanges ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={pullChanges}
          >
            <ArrowDownToLine size={16} />
            Pull
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || !hasLocalEdits}
          onClick={() => setShowCommitModal(true)}
        >
          <GitCommitHorizontal size={16} />
          Commit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || !hasUnpushedCommits || hasRemoteChanges}
          onClick={() => {
            setShowCommitModal(false);
            pushChanges();
          }}
        >
          <ArrowUpFromLine size={16} />
          Push
          {pendingPushCommitCount > 0 ? (
            <Badge variant="secondary" className="size-4">
              {pendingPushCommitCount}
            </Badge>
          ) : null}
        </Button>
      </div>
      <GitBranchModal
        open={showBranchModal}
        onOpenChange={setShowBranchModal}
        workspaceId={workspaceId}
        currentBranch={activeBranch}
        hasLocalChanges={hasLocalEdits || hasUnpushedCommits}
        onBranchChanged={(nextBranch) => {
          resetGitState();
          setActiveBranch(nextBranch);
          setHasRemoteChanges(false);
          setShowCommitModal(false);
          router.refresh();
        }}
      />
      <GitCommitModal
        open={showCommitModal}
        onOpenChange={setShowCommitModal}
        message={commitMessage}
        onMessageChange={setCommitMessage}
        onConfirm={commitChanges}
        isPending={isPending}
        editCount={
          Object.keys(drafts).length +
          pendingCollectionDeletes.length +
          pendingLocalCollectionIds.length
        }
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
