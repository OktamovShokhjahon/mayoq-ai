"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";

/**
 * Dialog used for the short create flows. It traps focus, restores it on close,
 * closes on Escape and on a backdrop click, and locks page scroll — a clinician
 * filling this in should never lose the keyboard or find the page moving behind
 * them.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Callers declare `onClose` inline, so its identity changes on every render —
  // including the re-render caused by typing a character. Reading it through a
  // ref keeps the effect below tied to `open` alone; depending on the callback
  // directly tore the dialog down and refocused the first field on a keystroke.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // The portal can only exist after mount. Testing for `document` instead would
  // render nothing on the server but a full dialog on the very first client
  // render, which fails hydration whenever a modal starts open.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Focus the first control rather than the panel, so typing starts straight away.
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    // Prefer the first field over the first focusable. The close button sits
    // ahead of the body in DOM order, so "first focusable" put the cursor on
    // ✕ and silently dropped whatever the clinician typed next.
    const firstField = () =>
      panelRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
      ) ?? focusables()[0];

    const timer = window.setTimeout(() => firstField()?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      window.clearTimeout(timer);
      restoreFocusTo.current?.focus?.();
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 bg-ink/25 backdrop-blur-[2px]"
        style={{ animation: "modal-fade 160ms ease-out both" }}
      />

      <div
        ref={panelRef}
        className={`panel relative z-10 my-auto w-full ${size === "lg" ? "max-w-2xl" : "max-w-md"}`}
        style={{ animation: "modal-rise 200ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="display text-[18px] leading-tight text-ink">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("action.close")}
            className="shrink-0 rounded px-2 py-1 font-mono text-[13px] text-ink-faint transition hover:bg-ink/[0.05] hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--line)] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Shared field shell, so every create form looks and behaves the same. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="readout">{label}</span>
      {children}
      {hint && <span className="text-[12px] leading-snug text-ink-faint">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded border border-[color:var(--line)] bg-surface px-3 py-2 text-[15px] text-ink outline-none transition focus:border-signal";
