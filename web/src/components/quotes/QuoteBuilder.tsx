import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type QuoteBuilderHeader = {
  title: string;
  breadcrumbs: ReactNode;
  tenantName?: string | null;
  status?: string | null;
  meta?: ReactNode;
};

export type QuoteBuilderProps = {
  header: QuoteBuilderHeader;
  actionsBar: ReactNode;
  notice?: ReactNode;
  error?: ReactNode;
  isLoading?: boolean;
  loadingState?: ReactNode;
  leftColumn: ReactNode;
  rightColumn: ReactNode;
};

export function QuoteBuilder({
  header,
  actionsBar,
  notice,
  error,
  isLoading,
  loadingState,
  leftColumn,
  rightColumn,
}: QuoteBuilderProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">{header.breadcrumbs}</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{header.title}</h1>
            {header.status && (
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium capitalize">
                {header.status.toLowerCase().replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {header.tenantName && <span className="font-medium text-foreground/80">{header.tenantName}</span>}
            {header.meta}
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-30 -mx-4 border-b bg-background/95 py-3 backdrop-blur lg:-mx-6">
        <div className="mx-auto w-full max-w-6xl px-4 lg:px-6">{actionsBar}</div>
      </div>

      {error}
      {notice}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          {loadingState ?? (
            <>
              <div className="space-y-4 lg:col-span-1">
                <div className={cn("h-80 rounded-2xl bg-muted/40")}></div>
              </div>
              <div className="space-y-4 lg:col-span-2">
                <div className={cn("h-64 rounded-2xl bg-muted/40")}></div>
                <div className={cn("h-96 rounded-2xl bg-muted/40")}></div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="space-y-4 lg:col-span-1">{leftColumn}</div>
          <div className="space-y-4 lg:col-span-2">{rightColumn}</div>
        </div>
      )}
    </div>
  );
}
