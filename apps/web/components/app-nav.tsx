import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@neondatabase/auth/react";
import { GitBranch, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { userButtonClassNames } from "@/lib/auth/user-button";

export function AppNav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link className="flex items-center gap-2 font-semibold" href="/">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-700 text-white">
            <Layers3 size={18} />
          </span>
          TokenCraft Neo
        </Link>
        <nav className="flex items-center gap-2">
          <SignedOut>
            <Button asChild variant="secondary" size="sm">
              <Link href="/auth/sign-in">
                Sign in
              </Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <Button asChild size="sm">
              <Link href="/dashboard">
                <GitBranch size={15} />
                Dashboard
              </Link>
            </Button>
            <UserButton
              size="icon"
              side="bottom"
              align="end"
              sideOffset={10}
              classNames={userButtonClassNames}
            />
          </SignedIn>
        </nav>
      </div>
    </header>
  );
}
