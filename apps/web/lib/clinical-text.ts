"use client";

import { useCallback } from "react";
import { useI18n } from "./i18n";
import type { MessageKey } from "./locales/uz";

type Vars = Record<string, string | number> | undefined;

/**
 * Text the API sends as a message key plus the English it was written in.
 *
 * The clinical catalogs — rules, prevention programs, disease chains — live on
 * the server, because that is where they are evaluated and versioned. Their
 * wording lives here, because that is where the reader's language is known.
 * So a finding arrives as both: a key this console can translate, and the
 * English sentence the catalog holds.
 *
 * The English is the fallback, not the default. It is used only when the key is
 * absent (an analysis stored before the keys existed) or missing from every
 * dictionary — in which case a clinician reads a real sentence in the wrong
 * language rather than `rule.T2DM_METFORMIN_RENAL.missing`.
 */
export function useClinicalText() {
  const { t } = useI18n();

  return useCallback(
    (key: string | undefined, fallback: string | undefined, vars?: Vars): string => {
      if (!key) return fallback ?? "";
      const translated = t(key as MessageKey, vars);
      // `t` echoes the key when nothing carries it, in any locale.
      return translated === key ? fallback ?? key : translated;
    },
    [t]
  );
}

export type ClinicalText = ReturnType<typeof useClinicalText>;

/** A signal as every clinical surface receives it: text, and the key behind it. */
export interface KeyedSignal {
  explanation: string;
  explanationKey?: string;
  explanationVars?: Record<string, string | number>;
  monitoring?: string;
  monitoringKey?: string;
}

export function signalExplanation(text: ClinicalText, signal: KeyedSignal): string {
  return text(signal.explanationKey, signal.explanation, signal.explanationVars);
}

export function signalMonitoring(text: ClinicalText, signal: KeyedSignal): string | undefined {
  if (!signal.monitoring && !signal.monitoringKey) return undefined;
  return text(signal.monitoringKey, signal.monitoring);
}
