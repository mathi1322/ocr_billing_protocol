"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Health {
  status: string;
  supabase_configured: boolean;
  openai_configured: boolean;
  anthropic_configured: boolean;
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"}`} />
  );
}

export default function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/health`).then((r) => r.json()).then(setHealth).catch(() => {});
    createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Account</h2>
        <p className="mt-3 text-sm">
          Signed in as <span className="font-medium">{email ?? "…"}</span>
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Extraction providers
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-2.5">
            <Dot ok={health?.openai_configured ?? false} />
            OpenAI (primary) {health?.openai_configured ? "" : "— not configured"}
          </li>
          <li className="flex items-center gap-2.5">
            <Dot ok={health?.anthropic_configured ?? false} />
            Claude (fallback) {health?.anthropic_configured ? "" : "— not configured; fallback disabled"}
          </li>
          <li className="flex items-center gap-2.5">
            <Dot ok={health?.supabase_configured ?? false} />
            Supabase (database, auth, storage)
          </li>
        </ul>
        <p className="mt-4 text-xs text-neutral-400">
          Models and validation thresholds are configured in the backend <code>.env</code> file.
        </p>
      </section>
    </main>
  );
}
