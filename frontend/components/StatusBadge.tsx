const STYLES: Record<string, string> = {
  extracted:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  processing:
    "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/30",
  failed:
    "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30",
};

const DOTS: Record<string, string> = {
  extracted: "bg-emerald-500",
  processing: "bg-sky-500 animate-pulse",
  failed: "bg-rose-500",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STYLES[status] ??
        "bg-neutral-100 text-neutral-700 ring-neutral-600/20 dark:bg-neutral-500/10 dark:text-neutral-400 dark:ring-neutral-500/30"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[status] ?? "bg-neutral-400"}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
