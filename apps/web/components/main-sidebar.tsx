"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type PointerEvent } from "react";
import { GitPullRequest, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SidebarCollections } from "@/components/sidebar-collections";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

import type { TokenSidebarCollection } from "@/lib/tokens/entries";

export function MainSidebar({
  showCollections = false,
  collections = [],
  folders = [],
}: {
  showCollections?: boolean;
  collections?: TokenSidebarCollection[];
  folders?: string[];
}) {
  const pathname = usePathname();
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const workspaceSlug = pathname.match(/\/dashboard\/workspaces\/([^/]+)/)?.[1];
  const settingsHref = workspaceSlug
    ? `/dashboard/workspaces/${encodeURIComponent(workspaceSlug)}/settings`
    : "/dashboard";

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = sidebarWidth;

    function resize(moveEvent: globalThis.PointerEvent) {
      setSidebarWidth(Math.min(400, Math.max(200, startWidth + moveEvent.clientX - startX)));
    }

    function stopResize() {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
    }

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize, { once: true });
  }

  return (
    <aside
      className="app-sidebar relative sticky left-0 top-0 z-50 flex h-screen shrink-0 flex-col overflow-visible border-r border-sidebar-border bg-sidebar"
      style={{ width: sidebarWidth }}
    >
      <div className="flex h-[57px] min-w-0 items-center gap-1 border-b border-sidebar-border px-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
            <svg
              width="15"
              height="17"
              viewBox="0 0 21 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19.6184 5.17157L21 5.95306V18.0469L19.6202 18.8271L19.6204 18.8273L10.4999 24L1.37963 18.8273L1.37985 18.8271L0 18.0469V5.95306L1.3814 5.17157L10.4999 0L19.6184 5.17157ZM2.25998 6.79059L1.81294 7.04341V16.9564L10.4999 21.8826L18.7398 17.2094L19.1871 16.9564V7.04341L18.7398 6.79059L10.4999 2.1172L2.25998 6.79059ZM6.35836 10.6653C6.22802 11.0872 6.15653 11.5354 6.15653 11.9999L6.15763 12.1002C6.20329 14.2007 7.67969 15.9405 9.63126 16.345V19.3616L3.55042 15.9119V9.07272L6.35836 10.6653ZM17.4496 15.9119L11.3687 19.3616V16.345C13.3203 15.9405 14.7967 14.2007 14.8424 12.1002L14.8435 11.9999C14.8435 11.5353 14.7711 11.0872 14.6408 10.6653L17.4496 9.07272V15.9119ZM16.5292 7.56486L13.7974 9.11429C13.0264 8.19699 11.8936 7.60354 10.6234 7.56734L10.4999 7.56576C9.17962 7.56578 7.9974 8.16716 7.20154 9.11429L4.46995 7.56486L10.4999 4.14561L16.5292 7.56486ZM13.1027 12.1368C13.0329 13.5426 11.8942 14.6605 10.4999 14.6605C9.10558 14.6604 7.96711 13.5426 7.89732 12.1368L7.89378 11.9999C7.89379 11.5296 8.01249 11.0902 8.22043 10.7087L8.30962 10.558C8.77479 9.82327 9.58241 9.33935 10.4999 9.33932L10.5913 9.3409C11.5317 9.37396 12.347 9.91582 12.7793 10.7087L12.8533 10.8542C13.0154 11.2003 13.106 11.5883 13.106 11.9999L13.1027 12.1368Z"
                fill="white"
              />
            </svg>
          </div>
          <span className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.025em] text-sidebar-foreground">
            Tokencraft
          </span>
        </Link>
      </div>

      <div className="relative z-50 shrink-0 overflow-visible">
        <WorkspaceSwitcher />
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-3 pb-4 pt-3"
        style={{ paddingLeft: 12, paddingRight: 12 }}
      >
        {showCollections ? (
          <SidebarCollections collections={collections} folders={folders} />
        ) : null}
      </div>

      <div className="flex items-center gap-1 overflow-x-hidden border-t border-sidebar-border p-3">
        <Link
          href={settingsHref}
          className={cn(
            "box-border flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname.includes("/settings")
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="truncate">Settings</span>
        </Link>
        <ThemeSwitcher />
      </div>

      <button
        type="button"
        aria-label="Resize main sidebar"
        onPointerDown={startResize}
        className="absolute inset-y-0 right-0 z-[60] w-1 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-primary/50 focus-visible:bg-primary/50 focus-visible:outline-none"
      />
    </aside>
  );
}
