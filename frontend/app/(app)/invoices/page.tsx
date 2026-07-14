"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Invoice, formatMoney, listInvoices } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

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

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const refresh = useCallback(
    (opts: { status: string; q: string }) => {
      setLoaded(false);
      listInvoices({ status: opts.status || undefined, q: opts.q || undefined })
        .then(setInvoices)
        .catch(() => {})
        .finally(() => setLoaded(true));
    },
    []
  );

  useEffect(() => {
    const t = setTimeout(() => refresh({ status, q }), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [status, q, refresh]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
      <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
        Every uploaded invoice with supplier and customer details.
      </p>

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
      </div>

      {/* Desktop table */}
      <div className="mt-5 hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm lg:block dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Customer (billed to)</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {!loaded && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-400">Loading…</td></tr>
            )}
            {loaded && invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-neutral-400">
                  {q || status ? "No invoices match the filters." : "No invoices yet — upload one from the dashboard."}
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
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
            {q || status ? "No invoices match the filters." : "No invoices yet."}
          </li>
        )}
        {invoices.map((inv) => (
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
