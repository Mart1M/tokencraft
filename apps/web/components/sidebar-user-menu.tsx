"use client";

import { UserButton } from "@neondatabase/auth/react";
import { ChevronDown } from "lucide-react";

import { authClient } from "@/lib/auth/neon-client";
import { userButtonClassNames } from "@/lib/auth/user-button";
import { cn } from "@/lib/utils";

export function SidebarUserMenu({ collapsed }: { collapsed: boolean }) {
  const { data } = authClient.useSession();
  const user = data?.user;
  const name = user?.name || "Account";
  const email = user?.email || "Signed in";
  const initial = name.charAt(0).toUpperCase();

  if (collapsed) {
    return (
      <UserButton
        size="icon"
        side="right"
        align="end"
        sideOffset={12}
        classNames={{
          ...userButtonClassNames,
          trigger: {
            ...userButtonClassNames.trigger,
            base: "rounded-lg hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
          }
        }}
      />
    );
  }

  return (
    <UserButton
      side="right"
      align="end"
      sideOffset={12}
      classNames={userButtonClassNames}
      trigger={
        <button
          type="button"
          className={cn(
            "box-border flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
            "hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-sidebar-foreground">{name}</span>
            <span className="block truncate text-xs text-sidebar-foreground/60">{email}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
        </button>
      }
    />
  );
}
