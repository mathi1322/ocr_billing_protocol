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

export interface InvoiceDetail extends Invoice {
  line_items: LineItem[];
  file_url: string | null;
  mime_type: string | null;
}

export function formatMoney(amount: number | null | undefined, currency: string | null): string {
  if (amount == null) return "—";
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency ?? ""}`;
}

export async function uploadInvoice(file: File): Promise<Invoice> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/invoices`, {
    method: "POST",
    body: form,
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function listInvoices(opts?: {
  status?: string;
  q?: string;
}): Promise<Invoice[]> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.q) params.set("q", opts.q);
  const qs = params.toString();
  const res = await fetch(`${API_URL}/api/invoices${qs ? `?${qs}` : ""}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load invoices (${res.status})`);
  return res.json();
}

export async function getInvoice(id: string): Promise<InvoiceDetail> {
  const res = await fetch(`${API_URL}/api/invoices/${id}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load invoice (${res.status})`);
  return res.json();
}
