"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Invoice, formatMoney, listInvoices } from "@/lib/api";
import { StatTile } from "@/components/StatTile";
import { StatusBadge } from "@/components/StatusBadge";
import { UploadZone } from "@/components/UploadZone";

export default function Dashboard() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    listInvoices()
      .then(setInvoices)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const byCurrency = new Map<string, number>();
    const vendors = new Set<string>();
    let confSum = 0;
    let confCount = 0;
    for (const inv of invoices) {
      if (inv.total_amount != null && inv.currency) {
        byCurrency.set(inv.currency, (byCurrency.get(inv.currency) ?? 0) + inv.total_amount);
      }
      if (inv.vendor_name) vendors.add(inv.vendor_name);
      if (inv.confidence_score != null) {
        confSum += inv.confidence_score;
        confCount++;
      }
    }
    const spendParts = [...byCurrency.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cur, amt]) => formatMoney(amt, cur));
    return {
      spend: spendParts[0] ?? "—",
      spendHint: spendParts.length > 1 ? `+ ${spendParts.slice(1).join(" · ")}` : undefined,
      count: invoices.length,
      vendors: vendors.size,
      avgConfidence: confCount ? `${Math.round((confSum / confCount) * 100)}%` : "—",
    };
  }, [invoices]);

  const recent = invoices.slice(0, 5);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
        Every number below was extracted by AI and checked by the validation layer.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total spend" value={stats.spend} hint={stats.spendHint} accent />
        <StatTile label="Invoices" value={String(stats.count)} />
        <StatTile label="Vendors" value={String(stats.vendors)} />
        <StatTile label="Avg confidence" value={stats.avgConfidence} />
      </div>

      <div className="mt-6">
        <UploadZone onUploaded={refresh} />
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Recent activity
          </h2>
          <Link
            href="/invoices"
            className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            View all invoices →
          </Link>
        </div>

        <ul className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {loaded && recent.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-neutral-400">
              No invoices yet — drop one above to get started.
            </li>
          )}
          {recent.map((inv) => (
            <li
              key={inv.id}
              onClick={() => router.push(`/invoices/${inv.id}`)}
              className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {inv.vendor_name ?? inv.source_filename}
                  {inv.bill_to_name && (
                    <span className="ml-2 text-xs font-normal text-neutral-400">
                      → {inv.bill_to_name}
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-400">
                  {inv.invoice_number && `#${inv.invoice_number} · `}
                  {inv.invoice_date}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">
                  {formatMoney(inv.total_amount, inv.currency)}
                </span>
                <StatusBadge status={inv.status} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
