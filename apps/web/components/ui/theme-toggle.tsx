"use client";

import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

/**
 * Day/night switch. The lamp in the mark is lit at night and dark by day, so
 * the control shows the state the console is in rather than a generic icon
 * pair — and it always says which, because the icon alone is ambiguous.
 */
export function ThemeToggle({ onNavy = false }: { onNavy?: boolean }) {
  const { resolved, toggle } = useTheme();
  const { t } = useI18n();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? t("theme.toDay") : t("theme.toNight")}
      title={isDark ? t("theme.day") : t("theme.night")}
      className={`group inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
        onNavy
          ? "border-white/15 text-white/55 hover:border-white/30 hover:text-white"
          : "border-[color:var(--line)] text-ink-faint hover:border-[color:var(--line-strong)] hover:text-ink"
      }`}
    >
      <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 shrink-0">
        {isDark ? (
          <>
            {/* Lamp lit: a beam thrown from the lens. */}
            <circle cx="8" cy="8" r="2.6" fill="var(--lamp)" />
            <g stroke="var(--lamp)" strokeWidth="1.2" strokeLinecap="round" opacity="0.75">
              <path d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6" />
              <path d="M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
            </g>
          </>
        ) : (
          <>
            {/* Lamp dark: the lens, unlit. */}
            <circle
              cx="8"
              cy="8"
              r="4.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              opacity="0.9"
            />
            <path d="M8 3.4a4.6 4.6 0 0 0 0 9.2z" fill="currentColor" opacity="0.55" />
          </>
        )}
      </svg>
      {isDark ? t("theme.night") : t("theme.day")}
    </button>
  );
}
