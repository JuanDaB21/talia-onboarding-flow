import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
  /** Texto opcional debajo del spinner. */
  label?: string;
  className?: string;
  compact?: boolean;
}

/** Spinner centralizado para estados de carga. */
export function LoadingState({ label = "Cargando…", className, compact = false }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-muted-foreground",
        compact ? "gap-2 py-4" : "gap-3 py-10",
        className,
      )}
    >
      <Loader2 className={cn("animate-spin", compact ? "h-4 w-4" : "h-6 w-6")} />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}

interface SkeletonListProps {
  rows?: number;
  rowHeightClass?: string;
  className?: string;
}

/** Lista vertical de skeletons para tablas/listados que cargan. */
export function SkeletonList({ rows = 5, rowHeightClass = "h-10", className }: SkeletonListProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full", rowHeightClass)} />
      ))}
    </div>
  );
}
