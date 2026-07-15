"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const inputCls =
  "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-700 dark:bg-neutral-950";

export default function SettingsPage() {
  const toast = useToast();
  const [health, setHealth] = useState<Health | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/health`).then((r) => r.json()).then(setHealth).catch(() => {});
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null);
        setName((data.user?.user_metadata?.full_name as string) ?? "");
      });
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    const { error } = await createClient().auth.updateUser({ data: { full_name: name.trim() } });
    setSavingName(false);
    if (error) toast("error", error.message);
    else toast("success", "Name updated");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPw(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSavingPw(false);
    if (error) {
      toast("error", error.message);
    } else {
      setPassword("");
      toast("success", "Password changed");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Section title="Profile">
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Signed in as <span className="font-medium text-neutral-700 dark:text-neutral-300">{email ?? "…"}</span>
        </p>
        <form onSubmit={saveName} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label className="mb-1.5 block text-sm font-medium">Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={savingName}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {savingName ? "Saving…" : "Save"}
          </button>
        </form>
      </Section>

      <Section title="Change password">
        <form onSubmit={savePassword} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label className="mb-1.5 block text-sm font-medium">New password</label>
            <input
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={savingPw || password.length < 6}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {savingPw ? "Updating…" : "Update password"}
          </button>
        </form>
      </Section>

      <Section title="Extraction providers">
        <ul className="space-y-2 text-sm">
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
      </Section>
    </main>
  );
}
