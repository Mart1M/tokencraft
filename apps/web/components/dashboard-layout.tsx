"use client";

import { MainSidebar } from "@/components/main-sidebar";
import { TokenExplorerProvider } from "@/components/token-explorer-provider";
import { TokenGroupSidebar } from "@/components/token-group-sidebar";

import type { ImportedTokenRow, TokenSidebarCollection } from "@/lib/tokens/entries";
import { cn } from "@/lib/utils";

export function DashboardLayout({
  children,
  showTokensSidebar = false,
  tokenSidebarCollections = [],
  tokenSidebarFolders = [],
  tokenExplorerModes = [],
  tokens = [],
}: {
  children: React.ReactNode;
  showTokensSidebar?: boolean;
  tokenSidebarCollections?: TokenSidebarCollection[];
  tokenSidebarFolders?: string[];
  tokenExplorerModes?: string[];
  tokens?: ImportedTokenRow[];
}) {
  return (
    <TokenExplorerProvider availableModes={tokenExplorerModes} collections={tokenSidebarCollections}>
      <div
        className={cn(
          "flex bg-background",
          showTokensSidebar ? "h-screen overflow-hidden" : "min-h-screen"
        )}
      >
        <MainSidebar
          showCollections={showTokensSidebar}
          collections={tokenSidebarCollections}
          folders={tokenSidebarFolders}
        />
        {showTokensSidebar ? <TokenGroupSidebar tokens={tokens} /> : null}
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
      </div>
    </TokenExplorerProvider>
  );
}
