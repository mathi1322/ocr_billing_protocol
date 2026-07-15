"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const NAV = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    href: "/invoices",
    label: "Bills",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.6a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 .3.7V19a2 2 0 0 1-2 2Z" />
      </svg>
    ),
  },
];

function ProfileMenu({
  email,
  displayName,
  align = "up",
}: {
  email: string | null;
  displayName: string | null;
  align?: "up" | "down";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (displayName || email || "?")[0].toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-semibold text-white shadow-sm">
          {initial}
        </span>
        <span className="hidden min-w-0 flex-1 text-left md:block">
          <span className="block truncate text-xs font-medium">{displayName || email || "…"}</span>
          {displayName && (
            <span className="block truncate text-[10px] text-neutral-400">{email}</span>
          )}
        </span>
      </button>

      {open && (
        <div
          className={`absolute z-40 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900 ${
            align === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"
          }`}
        >
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a7.723 7.723 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Settings
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null);
        setDisplayName((data.user?.user_metadata?.full_name as string) ?? null);
      });
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.6a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 .3.7V19a2 2 0 0 1-2 2Z" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight">OCR Billing</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
          <ProfileMenu email={email} displayName={displayName} align="up" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-950/90">
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.6a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 .3.7V19a2 2 0 0 1-2 2Z" />
            </svg>
          </span>
          <span className="text-sm font-semibold">OCR Billing</span>
        </span>
        <ProfileMenu email={email} displayName={displayName} align="down" />
      </header>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-950/95">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              isActive(item.href)
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-neutral-400 dark:text-neutral-500"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
