import { createClient } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function authHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export interface LineItem {
  id: string;
  description: string;
  hsn_sac: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  position: number;
}

export interface TaxLine {
  name: string;
  rate: number | null;
  amount: number;
}

export interface Invoice {
  id: string;
  status: string;
  source_filename: string | null;
  vendor_name: string | null;
  vendor_address: string | null;
  vendor_tax_id: string | null;
  bill_to_name: string | null;
  bill_to_address: string | null;
  bill_to_tax_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string | null;
  subtotal: number | null;
  tax_inclusive: boolean;
  tax_breakdown: TaxLine[];
  tax_amount: number | null;
  discount_amount: number | null;
  round_off: number | null;
  total_amount: number | null;
  payment_terms: string | null;
  confidence_score: number | null;
  flagged_fields: string[];
  winning_provider: string | null;
  extraction_json: Record<string, unknown> | null;
  created_at?: string;
}

export class DuplicateInvoiceError extends Error {
  existing_id: string;
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;

  constructor(detail: {
    existing_id: string;
    vendor_name: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
  }) {
    super("This file has already been uploaded");
    this.existing_id = detail.existing_id;
    this.vendor_name = detail.vendor_name;
    this.invoice_number = detail.invoice_number;
    this.invoice_date = detail.invoice_date;
  }
}

export interface InvoiceDetail extends Invoice {
  line_items: LineItem[];
  file_url: string | null;
  mime_type: string | null;
}

export function formatMoney(amount: number | null | undefined, currency: string | null): string {
  if (amount == null) return "—";
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  // Indian digit grouping (1,00,000) for INR; standard grouping otherwise
  const formatted = amount.toLocaleString(currency === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency ?? ""}`;
}

export async function uploadInvoice(file: File, force = false): Promise<Invoice> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/invoices${force ? "?force=true" : ""}`, {
    method: "POST",
    body: form,
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 409 && body?.detail?.code === "duplicate_file") {
      throw new DuplicateInvoiceError(body.detail);
    }
    const detail = body?.detail;
    throw new Error(
      typeof detail === "string" ? detail : `Upload failed (${res.status})`
    );
  }
  return res.json();
}

export interface InvoiceFilters {
  status?: string;
  q?: string;
  date_from?: string;
  date_to?: string;
}

function filterParams(opts?: InvoiceFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.q) params.set("q", opts.q);
  if (opts?.date_from) params.set("date_from", opts.date_from);
  if (opts?.date_to) params.set("date_to", opts.date_to);
  return params;
}

export async function listInvoices(opts?: InvoiceFilters): Promise<Invoice[]> {
  const qs = filterParams(opts).toString();
  const res = await fetch(`${API_URL}/api/invoices${qs ? `?${qs}` : ""}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load invoices (${res.status})`);
  return res.json();
}

export async function downloadExport(
  format: "csv" | "xlsx",
  opts?: InvoiceFilters
): Promise<void> {
  const params = filterParams(opts);
  params.set("format", format);
  const res = await fetch(`${API_URL}/api/invoices/export?${params}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoices-${new Date().toISOString().slice(0, 10)}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getInvoice(id: string): Promise<InvoiceDetail> {
  const res = await fetch(`${API_URL}/api/invoices/${id}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load invoice (${res.status})`);
  return res.json();
}
