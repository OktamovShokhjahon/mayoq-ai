"use client";

import { LOCALES, useI18n, type Locale } from "@/lib/i18n";

/**
 * Language switch. Three languages is few enough to show all of them at once,
 * so there is no dropdown to open and no guessing which is active — and each
 * is written in its own language, because someone looking for Русский is not
 * reading the Uzbek word for it.
 */
const SHORT: Record<Locale, string> = { uz: "UZ", en: "EN", ru: "RU" };

export function LanguageSwitcher({ onNavy = false }: { onNavy?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className="flex items-center rounded-md border p-0.5"
      style={{ borderColor: onNavy ? "rgba(255,255,255,0.15)" : "var(--line)" }}
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            aria-label={t(`lang.${code}` as "lang.uz")}
            title={t(`lang.${code}` as "lang.uz")}
            className="rounded-sm px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition"
            style={{
              color: active
                ? onNavy
                  ? "#fff"
                  : "var(--ink)"
                : onNavy
                  ? "rgba(255,255,255,0.45)"
                  : "var(--ink-faint)",
              background: active ? "rgb(var(--rgb-lamp) / 0.16)" : "transparent",
            }}
          >
            {SHORT[code]}
          </button>
        );
      })}
    </div>
  );
}
