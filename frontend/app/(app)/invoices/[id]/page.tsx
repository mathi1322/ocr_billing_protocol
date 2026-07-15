"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { InvoiceDetail, formatMoney, getInvoice } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/Skeleton";

function Row({ label, value, flagged }: { label: string; value: React.ReactNode; flagged?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-neutral-500 dark:text-neutral-400">{label}</span>
      <span
        className={`text-right text-sm font-medium ${
          flagged
            ? "rounded bg-amber-50 px-1.5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
            : "text-neutral-900 dark:text-neutral-100"
        }`}
      >
        {value ?? <span className="text-neutral-300 dark:text-neutral-600">—</span>}
      </span>
    </div>
  );
}

function PartyBlock({
  title,
  name,
  address,
  taxId,
  flagged,
}: {
  title: string;
  name: string | null;
  address: string | null;
  taxId: string | null;
  flagged?: boolean;
}) {
  return (
    <div className="p-5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {title}
      </h3>
      <p className={`mt-2 font-semibold ${flagged ? "text-amber-700 dark:text-amber-400" : ""}`}>
        {name ?? <span className="font-normal text-neutral-300 dark:text-neutral-600">—</span>}
      </p>
      {address && (
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          {address}
        </p>
      )}
      {taxId && (
        <p className="mt-2 text-xs text-neutral-400">
          Tax ID <span className="font-mono">{taxId}</span>
        </p>
      )}
    </div>
  );
}

export default function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    getInvoice(id).then(setInv).catch((e) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-rose-600">{error}</main>
    );
  if (!inv)
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="h-4 w-16" />
        <div className="mt-4 flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-3.5 w-44" />
          </div>
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[560px] rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </main>
    );

  const flagged = new Set(inv.flagged_fields ?? []);
  const isPdf = inv.mime_type === "application/pdf";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        ← Bills
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {inv.vendor_name ?? inv.source_filename}
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {inv.invoice_number && `Bill #${inv.invoice_number} · `}
            {inv.invoice_date}
            {inv.winning_provider && ` · extracted via ${inv.winning_provider}`}
            {inv.confidence_score != null &&
              ` · confidence ${Math.round(inv.confidence_score * 100)}%`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-semibold tabular-nums">
            {formatMoney(inv.total_amount, inv.currency)}
          </span>
          <StatusBadge status={inv.status} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Document preview — sticky so it stays visible while scrolling the data */}
        <div className="self-start overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm lg:sticky lg:top-8 dark:border-neutral-800 dark:bg-neutral-900">
          {inv.file_url ? (
            isPdf ? (
              <iframe src={inv.file_url} className="h-[720px] w-full" title="Original document" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={inv.file_url} alt="Original document" className="w-full" />
            )
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
              Document preview unavailable
            </div>
          )}
        </div>

        {/* Extracted data — one unified panel, divider-separated */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            {/* Parties */}
            <div className="grid divide-y divide-neutral-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-neutral-800">
              <PartyBlock
                title="Vendor"
                name={inv.vendor_name}
                address={inv.vendor_address}
                taxId={inv.vendor_tax_id}
              />
              <PartyBlock
                title="Billed to"
                name={inv.bill_to_name}
                address={inv.bill_to_address}
                taxId={inv.bill_to_tax_id}
                flagged={flagged.has("bill_to_name")}
              />
            </div>

            {/* Line items */}
            <div className="border-t border-neutral-100 p-5 dark:border-neutral-800">
              <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                Line items
              </h3>

              {/* Mobile: stacked item cards (a 4-column table can't breathe at 360px) */}
              <ul className="mt-3 space-y-2 sm:hidden">
                {inv.line_items.length === 0 && (
                  <li className="py-3 text-center text-sm text-neutral-300 dark:text-neutral-600">
                    No line items extracted
                  </li>
                )}
                {inv.line_items.map((li) => (
                  <li key={li.id} className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/50">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm font-medium leading-snug">{li.description}</p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatMoney(li.amount, inv.currency)}
                      </p>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
                      {li.quantity != null && li.unit_price != null ? (
                        <span className="tabular-nums">
                          {li.quantity} × {formatMoney(li.unit_price, inv.currency)}
                        </span>
                      ) : li.quantity != null ? (
                        <span className="tabular-nums">qty {li.quantity}</span>
                      ) : null}
                      {li.hsn_sac && (
                        <span className="rounded bg-neutral-200/70 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400">
                          HSN {li.hsn_sac}
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>

              {/* Desktop / tablet: table */}
              <table className="mt-3 hidden w-full text-sm sm:table">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Unit</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {inv.line_items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-neutral-300 dark:text-neutral-600">
                        No line items extracted
                      </td>
                    </tr>
                  )}
                  {inv.line_items.map((li) => (
                    <tr key={li.id}>
                      <td className="py-2 pr-2">
                        {li.description}
                        {li.hsn_sac && (
                          <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                            HSN {li.hsn_sac}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums">{li.quantity ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums">
                        {li.unit_price != null ? formatMoney(li.unit_price, inv.currency) : "—"}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {formatMoney(li.amount, inv.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-neutral-100 bg-neutral-50/60 p-5 dark:border-neutral-800 dark:bg-neutral-950/40">
              <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                Totals{inv.tax_inclusive ? " · tax-inclusive pricing" : ""}
              </h3>
              <div className="mt-2">
                <Row label="Subtotal" value={formatMoney(inv.subtotal, inv.currency)} flagged={flagged.has("subtotal")} />
                {inv.discount_amount != null && (
                  <Row label="Discount" value={`− ${formatMoney(inv.discount_amount, inv.currency)}`} />
                )}
                {(inv.tax_breakdown ?? []).map((t, i) => (
                  <Row
                    key={i}
                    label={`${t.name}${t.rate != null ? ` (${t.rate}%)` : ""}${inv.tax_inclusive ? " · included" : ""}`}
                    value={formatMoney(t.amount, inv.currency)}
                  />
                ))}
                {(!inv.tax_breakdown || inv.tax_breakdown.length === 0) && inv.tax_amount != null && (
                  <Row
                    label={`Tax${inv.tax_inclusive ? " (included)" : ""}`}
                    value={formatMoney(inv.tax_amount, inv.currency)}
                    flagged={flagged.has("tax_amount")}
                  />
                )}
                {inv.round_off != null && inv.round_off !== 0 && (
                  <Row label="Round off" value={formatMoney(inv.round_off, inv.currency)} />
                )}
                <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                  <Row
                    label="Total"
                    value={
                      <span className="text-base font-semibold">
                        {formatMoney(inv.total_amount, inv.currency)}
                      </span>
                    }
                  />
                </div>
                {inv.due_date && <Row label="Due date" value={inv.due_date} />}
                {inv.payment_terms && <Row label="Payment terms" value={inv.payment_terms} />}
              </div>
            </div>
          </div>

          {flagged.size > 0 && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
              <span className="font-medium">Flagged for attention:</span>{" "}
              {[...flagged].join(", ").replace(/_/g, " ")}
            </div>
          )}

          <button
            onClick={() => setShowJson((s) => !s)}
            className="text-xs text-neutral-400 underline-offset-2 hover:underline"
          >
            {showJson ? "Hide" : "Show"} raw extraction JSON
          </button>
          {showJson && (
            <pre className="overflow-x-auto rounded-xl bg-neutral-900 p-4 text-xs text-neutral-100 dark:bg-black">
              {JSON.stringify(inv.extraction_json, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </main>
  );
}
