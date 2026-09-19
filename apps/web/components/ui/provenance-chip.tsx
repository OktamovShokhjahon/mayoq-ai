"use client";

import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";
import type { EvidenceGrade } from "@/components/digital-twin/types";

/**
 * Evidence grade, per technical mission §5. The product's core promise is that
 * a verified fact, an unreviewed AI extraction, a deterministic rule result and
 * a scenario projection never look alike — so this chip is the structural
 * device that runs through the whole interface.
 *
 * Only the styling lives here now; the label and description are message keys,
 * because the grade is the first thing a clinician reads and it has to be in
 * the language they are working in.
 */
const GRADES: Record<EvidenceGrade, { classes: string }> = {
  verified: { classes: "border-state-green/40 bg-state-green/10 text-state-green" },
  ai_unverified: { classes: "border-ai/40 bg-ai/10 text-ai" },
  clinical_rule: { classes: "border-signal/40 bg-signal/10 text-signal" },
  ai_interpretation: { classes: "border-ai/40 bg-ai/10 text-ai" },
  projection: { classes: "border-electric/40 bg-electric/10 text-electric" },
};

/** `evidence.verified` / `evidence.verifiedDesc` — derived, so a new grade cannot forget one. */
export function gradeLabelKey(grade: EvidenceGrade): MessageKey {
  return `evidence.${grade}` as MessageKey;
}

export function gradeDescriptionKey(grade: EvidenceGrade): MessageKey {
  return `evidence.${grade}Desc` as MessageKey;
}

export function ProvenanceChip({ grade }: { grade: EvidenceGrade }) {
  const { t } = useI18n();
  return (
    <span
      title={t(gradeDescriptionKey(grade))}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${GRADES[grade].classes}`}
    >
      <span aria-hidden className="h-1 w-1 rounded-full bg-current" />
      {t(gradeLabelKey(grade))}
    </span>
  );
}

export const EVIDENCE_GRADES = GRADES;
