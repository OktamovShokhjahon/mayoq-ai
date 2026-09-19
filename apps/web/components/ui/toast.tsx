"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

/**
 * Confirmation for actions whose result is otherwise invisible — approving a
 * record, publishing a scenario, copying a password. Deliberately not used for
 * clinical findings: a risk signal belongs on the chart, where it stays put,
 * not in something that fades after four seconds.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-14 right-4 z-50 flex flex-col items-end gap-2"
        aria-live="polite"
        role="status"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border bg-surface px-3.5 py-2.5 text-[13px] text-ink shadow-lg"
              style={{
                borderColor:
                  toast.tone === "error"
                    ? "color-mix(in srgb, var(--state-red) 40%, transparent)"
                    : "var(--line)",
              }}
            >
              <span
                aria-hidden
                className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{
                  background:
                    toast.tone === "error"
                      ? "var(--state-red)"
                      : toast.tone === "info"
                        ? "var(--signal)"
                        : "var(--state-green)",
                }}
              >
                {toast.tone === "error" ? "✕" : toast.tone === "info" ? "i" : "✓"}
              </span>
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
