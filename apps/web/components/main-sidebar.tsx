"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitPullRequest, LayoutDashboard, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/sidebar-store";
import { Badge } from "@/components/ui/badge";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

const navItems = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    isActive: (pathname: string) => pathname === "/dashboard",
  },
  {
    hrefKey: "tokens" as const,
    label: "Tokens",
    icon: GitPullRequest,
    isActive: (pathname: string) => pathname.includes("/tokens"),
  },
];

export function MainSidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebarStore();
  const workspaceSlug = pathname.match(/\/dashboard\/workspaces\/([^/]+)/)?.[1];
  const tokensHref = workspaceSlug
    ? `/dashboard/workspaces/${encodeURIComponent(workspaceSlug)}/tokens`
    : "/dashboard/tokens";
  const settingsHref = workspaceSlug
    ? `/dashboard/workspaces/${encodeURIComponent(workspaceSlug)}/settings`
    : "/dashboard/settings";

  return (
    <aside
      className={cn(
        "app-sidebar sticky left-0 top-0 z-50 h-screen shrink-0 overflow-visible border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="flex h-full min-w-0 flex-col overflow-visible">
        <div className="flex h-[57px] min-w-0 items-center border-b border-sidebar-border px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <GitPullRequest size={20} className="text-primary-foreground" />
              </div>
              <span className="min-w-0 truncate font-serif text-xl font-semibold text-sidebar-foreground">
                Tokencraft
                <Badge variant="outline" className="ml-1 font-sans">
                  Beta
                </Badge>
              </span>
            </Link>
          )}
          {collapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <GitPullRequest size={20} className="text-primary-foreground" />
            </div>
          )}
        </div>

        <div className="relative z-50 shrink-0 overflow-visible">
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>

        <nav
          className="flex flex-1 flex-col overflow-x-hidden px-3 pb-4"
          style={{ gap: 8, paddingLeft: 12, paddingRight: 12 }}
        >
          {navItems.map((item) => {
            const isActive = item.isActive(pathname);
            const href =
              "hrefKey" in item && item.hrefKey === "tokens"
                ? tokensHref
                : item.href;
            return (
              <Link
                key={item.label}
                href={href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "box-border flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div
          className="flex flex-col overflow-x-hidden border-t border-sidebar-border p-3"
          style={{ gap: 8, padding: 12 }}
        >
          <Link
            href={settingsHref}
            title={collapsed ? "Settings" : undefined}
            className={cn(
              "box-border flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/dashboard/settings" ||
                pathname.includes("/settings")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Settings</span>}
          </Link>
        </div>

        <div
          className="overflow-x-hidden border-t border-sidebar-border p-3"
          style={{ padding: 12 }}
        >
          <SidebarUserMenu collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}
