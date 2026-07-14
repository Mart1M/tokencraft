"use client";

import { MainSidebar } from "@/components/main-sidebar";
import { TokenExplorerProvider } from "@/components/token-explorer-provider";
import { TokensSidebar } from "@/components/tokens-sidebar";

import type { TokenSidebarCollection } from "@/lib/tokens/entries";
import { cn } from "@/lib/utils";

export function DashboardLayout({
  children,
  showTokensSidebar = false,
  tokenSidebarCollections = [],
  tokenExplorerModes = [],
  workspaceId,
}: {
  children: React.ReactNode;
  showTokensSidebar?: boolean;
  tokenSidebarCollections?: TokenSidebarCollection[];
  tokenExplorerModes?: string[];
  workspaceId?: string;
}) {
  const explorerContent = (
    <>
      {showTokensSidebar && workspaceId ? (
        <TokensSidebar workspaceId={workspaceId} collections={tokenSidebarCollections} />
      ) : null}
      <main
        className={cn(
          "min-w-0 flex-1 overflow-x-hidden",
          showTokensSidebar
            ? "flex h-full min-h-0 flex-col overflow-hidden"
            : "px-8"
        )}
      >
        {children}
      </main>
    </>
  );

  return (
    <div
      className={cn(
        "flex bg-background",
        showTokensSidebar ? "h-screen overflow-hidden" : "min-h-screen"
      )}
    >
      <MainSidebar />
      {showTokensSidebar ? (
        <TokenExplorerProvider
          availableModes={tokenExplorerModes}
          collections={tokenSidebarCollections}
        >
          {explorerContent}
        </TokenExplorerProvider>
      ) : (
        explorerContent
      )}
    </div>
  );
}
