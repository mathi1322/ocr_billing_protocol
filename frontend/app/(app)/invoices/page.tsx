"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Invoice, downloadExport, formatMoney, listInvoices } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { SkeletonRow, EmptyState } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "extracted", label: "Extracted" },
  { value: "failed", label: "Failed" },
];

function Party({
  name,
  address,
  taxId,
}: {
  name: string | null;
  address: string | null;
  taxId: string | null;
}) {
  if (!name && !address && !taxId)
    return <span className="text-neutral-300 dark:text-neutral-600">—</span>;
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{name ?? "—"}</p>
      {address && (
        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-400 dark:text-neutral-500">
          {address.replace(/\n/g, ", ")}
        </p>
      )}
      {taxId && (
        <p className="mt-0.5 font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
          {taxId}
        </p>
      )}
    </div>
  );
}

type SortKey = "date" | "amount" | null;

function BillsPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDesc, setSortDesc] = useState(true);

  function toggleSort(key: Exclude<SortKey, null>) {
    if (sortKey === key) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  const filters = {
    status: status || undefined,
    q: q || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };

  const sorted = useMemo(() => {
    if (!sortKey) return invoices;
    const arr = [...invoices];
    arr.sort((a, b) => {
      const av = sortKey === "date" ? a.invoice_date ?? "" : a.total_amount ?? -Infinity;
      const bv = sortKey === "date" ? b.invoice_date ?? "" : b.total_amount ?? -Infinity;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDesc ? -cmp : cmp;
    });
    return arr;
  }, [invoices, sortKey, sortDesc]);

  async function onExport(format: "csv" | "xlsx") {
    setExporting(format);
    try {
      await downloadExport(format, filters);
      toast("success", format === "csv" ? "CSV downloaded" : "Excel downloaded");
    } catch {
      toast("error", "Export failed — try again");
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    const t = setTimeout(
      () => {
        setLoaded(false);
        listInvoices({
          status: status || undefined,
          q: q || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        })
          .then(setInvoices)
          .catch(() => {})
          .finally(() => setLoaded(true));
      },
      q ? 350 : 0
    );
    return () => clearTimeout(t);
  }, [status, q, dateFrom, dateTo]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            Every uploaded bill with supplier and customer details.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onExport("csv")}
            disabled={exporting !== null || invoices.length === 0}
            className="rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {exporting === "csv" ? "Exporting…" : "Export CSV"}
          </button>
          <button
            onClick={() => onExport("xlsx")}
            disabled={exporting !== null || invoices.length === 0}
            className="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {exporting === "xlsx" ? "Exporting…" : "Export Excel"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search supplier, customer, or invoice number…"
            className="w-full rounded-xl border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                status === f.value
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-neutral-600 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-700 dark:hover:bg-neutral-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-xs text-neutral-400">From</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-neutral-300 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:[color-scheme:dark]"
          />
          <label className="text-xs text-neutral-400">To</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-neutral-300 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:[color-scheme:dark]"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="text-xs text-neutral-400 underline-offset-2 hover:text-neutral-600 hover:underline dark:hover:text-neutral-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filtered summary strip */}
      {loaded && invoices.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-neutral-100 px-4 py-2.5 text-sm dark:bg-neutral-900">
          <span className="font-medium">{invoices.length} bill{invoices.length === 1 ? "" : "s"}</span>
          {Object.entries(
            invoices.reduce<Record<string, number>>((acc, inv) => {
              if (inv.total_amount != null && inv.currency) {
                acc[inv.currency] = (acc[inv.currency] ?? 0) + inv.total_amount;
              }
              return acc;
            }, {})
          ).map(([cur, amt]) => (
            <span key={cur} className="tabular-nums text-neutral-600 dark:text-neutral-300">
              {formatMoney(amt, cur)}
            </span>
          ))}
          {(q || status || dateFrom || dateTo) && (
            <span className="text-xs text-neutral-400">(matching current filters)</span>
          )}
        </div>
      )}

      {/* Desktop table */}
      <div className="mt-5 hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm lg:block dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
              <th className="px-4 py-3 font-medium">Bill</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Customer (billed to)</th>
              <th className="px-4 py-3 font-medium">
                <button onClick={() => toggleSort("date")} className="flex items-center gap-1 uppercase hover:text-neutral-600 dark:hover:text-neutral-300">
                  Date {sortKey === "date" && <span>{sortDesc ? "↓" : "↑"}</span>}
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium">
                <button onClick={() => toggleSort("amount")} className="ml-auto flex items-center gap-1 uppercase hover:text-neutral-600 dark:hover:text-neutral-300">
                  Amount {sortKey === "amount" && <span>{sortDesc ? "↓" : "↑"}</span>}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {!loaded && (
              <tr>
                <td colSpan={6} className="p-0">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </td>
              </tr>
            )}
            {loaded && invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="p-0">
                  {q || status || dateFrom || dateTo ? (
                    <EmptyState
                      title="No bills match the filters"
                      subtitle="Try widening the date range or clearing the search."
                      action={
                        <button
                          onClick={() => {
                            setQ("");
                            setStatus("");
                            setDateFrom("");
                            setDateTo("");
                          }}
                          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          Clear all filters
                        </button>
                      }
                    />
                  ) : (
                    <EmptyState
                      title="No bills yet"
                      subtitle="Upload your first bill from the dashboard — PDF, photo, or Word."
                      action={
                        <button
                          onClick={() => router.push("/")}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                        >
                          Go to dashboard
                        </button>
                      }
                    />
                  )}
                </td>
              </tr>
            )}
            {sorted.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => router.push(`/invoices/${inv.id}`)}
                className="cursor-pointer align-top transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5"
              >
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-neutral-600 dark:text-neutral-300">
                    {inv.invoice_number ?? "—"}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-neutral-400">{inv.source_filename}</p>
                </td>
                <td className="max-w-56 px-4 py-3">
                  <Party name={inv.vendor_name} address={inv.vendor_address} taxId={inv.vendor_tax_id} />
                </td>
                <td className="max-w-56 px-4 py-3">
                  <Party name={inv.bill_to_name} address={inv.bill_to_address} taxId={inv.bill_to_tax_id} />
                </td>
                <td className="px-4 py-3 tabular-nums text-neutral-600 dark:text-neutral-300">
                  {inv.invoice_date ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatMoney(inv.total_amount, inv.currency)}
                </td>
                <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards */}
      <ul className="mt-5 space-y-3 lg:hidden">
        {loaded && invoices.length === 0 && (
          <li className="rounded-2xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
            {q || status || dateFrom || dateTo ? "No bills match the filters." : "No bills yet — upload one from the dashboard."}
          </li>
        )}
        {sorted.map((inv) => (
          <li
            key={inv.id}
            onClick={() => router.push(`/invoices/${inv.id}`)}
            className="cursor-pointer rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm active:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{inv.vendor_name ?? inv.source_filename}</p>
                {inv.invoice_number && (
                  <p className="font-mono text-[11px] text-neutral-400">#{inv.invoice_number}</p>
                )}
              </div>
              <StatusBadge status={inv.status} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-neutral-400">Billed to</p>
                <p className="truncate">{inv.bill_to_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-neutral-400">Date</p>
                <p>{inv.invoice_date ?? "—"}</p>
              </div>
            </div>
            <p className="mt-2 text-right text-base font-semibold tabular-nums">
              {formatMoney(inv.total_amount, inv.currency)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function BillsPageWithParams() {
  return (
    <Suspense fallback={null}>
      <BillsPage />
    </Suspense>
  );
}
