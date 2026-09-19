"use client";

import { useI18n } from "@/lib/i18n";

export function SafetyBanner() {
  const { t } = useI18n();
  return (
    <footer
      className="border-t bg-paper-deep/60 px-4 py-2.5 text-center"
      style={{ borderColor: "var(--line)" }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
        <span className="text-signal">{t("safety.lead")}</span> · {t("safety.rest")}
      </p>
    </footer>
  );
}
