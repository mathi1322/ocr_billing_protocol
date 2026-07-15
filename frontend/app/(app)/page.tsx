"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Invoice, formatMoney, listInvoices } from "@/lib/api";
import { convert, getUsdInrRate, timeAgo } from "@/lib/rates";
import { StatusBadge } from "@/components/StatusBadge";
import { UploadZone } from "@/components/UploadZone";
import { EmptyState, Skeleton, SkeletonRow } from "@/components/Skeleton";

const PERIODS = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "3months", label: "Last 3 months" },
  { value: "all", label: "All time" },
] as const;

type Period = (typeof PERIODS)[number]["value"];
type DisplayCurrency = "INR" | "USD";

function periodStart(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "week": {
      const d = new Date(now);
      d.setDate(now.getDate() - now.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "3months":
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    case "all":
      return null;
  }
}

export default function Dashboard() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState<Period>("all");
  const [currency, setCurrency] = useState<DisplayCurrency>("INR");
  const [usdInr, setUsdInr] = useState(83);
  const [uploadOpen, setUploadOpen] = useState(false);

  const refresh = useCallback(() => {
    listInvoices()
      .then(setInvoices)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
    getUsdInrRate().then(setUsdInr);
  }, [refresh]);

  const filtered = useMemo(() => {
    const start = periodStart(period);
    if (!start) return invoices;
    return invoices.filter((inv) => {
      const d = inv.invoice_date ?? inv.created_at;
      return d ? new Date(d) >= start : false;
    });
  }, [invoices, period]);

  const stats = useMemo(() => {
    const vendors = new Map<string, number>();
    let spend = 0;
    for (const inv of filtered) {
      if (inv.total_amount != null) {
        const val = convert(inv.total_amount, inv.currency, currency, usdInr);
        spend += val;
        if (inv.vendor_name) {
          vendors.set(inv.vendor_name, (vendors.get(inv.vendor_name) ?? 0) + val);
        }
      }
    }
    const top = [...vendors.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      spend,
      bills: filtered.length,
      vendors: vendors.size,
      topVendor: top ? { name: top[0], amount: top[1] } : null,
    };
  }, [filtered, currency, usdInr]);

  const recent = filtered.slice(0, 5);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            Extracted by AI, checked by the validation layer.
          </p>
        </div>
        {/* Period filter */}
        <div className="flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                period === p.value
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      {!loaded ? (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="col-span-2 h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : (
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total spend — gradient hero tile with currency switch */}
        <div className="col-span-2 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-5 text-white shadow-lg shadow-emerald-900/20 lg:col-span-2">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-100/90">
              Total spend
            </p>
            <div className="flex rounded-lg bg-white/15 p-0.5 backdrop-blur">
              {(["INR", "USD"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    currency === c ? "bg-white text-emerald-700 shadow-sm" : "text-emerald-50/80"
                  }`}
                >
                  {c === "INR" ? "₹ INR" : "$ USD"}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight">
            {formatMoney(stats.spend, currency)}
          </p>
          <p className="mt-1.5 text-xs text-emerald-100/70">
            ≈ converted at ₹{usdInr.toFixed(2)}/US$ ·{" "}
            {PERIODS.find((p) => p.value === period)?.label.toLowerCase()}
          </p>
        </div>

        <button
          onClick={() => router.push("/invoices")}
          className="rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-emerald-700"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Total bills
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{stats.bills}</p>
          <p className="mt-1 text-xs text-neutral-400">across {stats.vendors} vendors →</p>
        </button>

        <button
          onClick={() =>
            stats.topVendor &&
            router.push(`/invoices?q=${encodeURIComponent(stats.topVendor.name)}`)
          }
          disabled={!stats.topVendor}
          className="rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-emerald-300 enabled:hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:enabled:hover:border-emerald-700"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Top vendor
          </p>
          {stats.topVendor ? (
            <>
              <p className="mt-2 truncate text-lg font-semibold tracking-tight">
                {stats.topVendor.name}
              </p>
              <p className="mt-1 text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(stats.topVendor.amount, currency)} →
              </p>
            </>
          ) : (
            <p className="mt-2 text-lg text-neutral-300 dark:text-neutral-600">—</p>
          )}
        </button>
      </div>
      )}

      {/* Recent activity */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Recent activity
          </h2>
          <Link
            href="/invoices"
            className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            View all bills →
          </Link>
        </div>

        <ul className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {!loaded && (
            <li>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </li>
          )}
          {loaded && recent.length === 0 && (
            <li>
              <EmptyState
                title="No bills yet"
                subtitle="Drop a PDF, snap a photo, or upload a Word file — the AI does the rest."
                action={
                  <button
                    onClick={() => setUploadOpen(true)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                  >
                    Upload your first bill
                  </button>
                }
              />
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
                  {inv.created_at && (
                    <span className="text-neutral-300 dark:text-neutral-600">
                      {" "}· uploaded {timeAgo(inv.created_at)}
                    </span>
                  )}
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

      {/* Floating upload button */}
      <button
        onClick={() => setUploadOpen(true)}
        aria-label="Upload invoice"
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-600/30 transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Upload modal */}
      {uploadOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUploadOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Upload bills</h3>
              <button
                onClick={() => setUploadOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <UploadZone onUploaded={refresh} />
          </div>
        </div>
      )}
    </main>
  );
}
