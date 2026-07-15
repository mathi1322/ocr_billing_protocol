export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-neutral-200/80 dark:bg-neutral-800 ${className}`}
    />
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
  );
}

export function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <span className="rounded-2xl bg-neutral-100 p-4 text-neutral-300 dark:bg-neutral-800 dark:text-neutral-600">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.6a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 .3.7V19a2 2 0 0 1-2 2Z" />
        </svg>
      </span>
      <p className="mt-3 font-medium text-neutral-700 dark:text-neutral-300">{title}</p>
      {subtitle && (
        <p className="mt-1 max-w-xs text-sm text-neutral-400 dark:text-neutral-500">{subtitle}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
