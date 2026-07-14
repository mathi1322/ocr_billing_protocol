"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { InvoiceDetail, formatMoney, getInvoice } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

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

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
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
      <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-neutral-400">
        Loading…
      </main>
    );

  const flagged = new Set(inv.flagged_fields ?? []);
  const isPdf = inv.mime_type === "application/pdf";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        ← Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {inv.vendor_name ?? inv.source_filename}
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {inv.invoice_number && `Invoice #${inv.invoice_number} · `}
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
        {/* Document preview */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
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

        {/* Extracted data */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Vendor">
              <p className="font-medium">{inv.vendor_name ?? "—"}</p>
              {inv.vendor_address && (
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-500 dark:text-neutral-400">
                  {inv.vendor_address}
                </p>
              )}
              {inv.vendor_tax_id && (
                <p className="mt-2 text-xs text-neutral-400">
                  Tax ID <span className="font-mono">{inv.vendor_tax_id}</span>
                </p>
              )}
            </Card>
            <Card title="Billed to">
              <p className={`font-medium ${flagged.has("bill_to_name") ? "text-amber-700 dark:text-amber-400" : ""}`}>
                {inv.bill_to_name ?? "—"}
              </p>
              {inv.bill_to_address && (
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-500 dark:text-neutral-400">
                  {inv.bill_to_address}
                </p>
              )}
              {inv.bill_to_tax_id && (
                <p className="mt-2 text-xs text-neutral-400">
                  Tax ID <span className="font-mono">{inv.bill_to_tax_id}</span>
                </p>
              )}
            </Card>
          </div>

          <Card title="Line items">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Unit</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
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
          </Card>

          <Card title={`Totals${inv.tax_inclusive ? " · tax-inclusive pricing" : ""}`}>
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
              <Row label={`Tax${inv.tax_inclusive ? " (included)" : ""}`} value={formatMoney(inv.tax_amount, inv.currency)} flagged={flagged.has("tax_amount")} />
            )}
            {inv.round_off != null && inv.round_off !== 0 && (
              <Row label="Round off" value={formatMoney(inv.round_off, inv.currency)} />
            )}
            <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
              <Row
                label="Total"
                value={<span className="text-base">{formatMoney(inv.total_amount, inv.currency)}</span>}
              />
            </div>
            <Row label="Due date" value={inv.due_date} flagged={flagged.has("due_date")} />
            {inv.payment_terms && <Row label="Payment terms" value={inv.payment_terms} />}
          </Card>

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
