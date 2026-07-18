import { cn } from "@/lib/utils";

export function DashboardPageHeader({
  title,
  actions,
  titleClassName,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="flex h-14 items-center border-b border-border/70 bg-background">
      <div className="flex w-full min-w-0 items-center justify-between gap-4 py-1">
        <h1
          className={cn(
            "min-w-0 text-base text-foreground",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {actions ? <div className="shrink-0 whitespace-nowrap">{actions}</div> : null}
      </div>
    </div>
  );
}
