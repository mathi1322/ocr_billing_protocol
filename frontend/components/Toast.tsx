"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Kind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: Kind;
  text: string;
}

const ToastCtx = createContext<(kind: Kind, text: string) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

const STYLES: Record<Kind, string> = {
  success:
    "bg-emerald-600 text-white shadow-emerald-600/25",
  error: "bg-rose-600 text-white shadow-rose-600/25",
  info: "bg-neutral-800 text-white shadow-neutral-900/25 dark:bg-neutral-700",
};

const ICONS: Record<Kind, React.ReactNode> = {
  success: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  ),
  error: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  ),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg animate-[toast-in_.25s_ease-out] ${STYLES[t.kind]}`}
          >
            {ICONS[t.kind]}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
