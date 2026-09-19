export type RiskColor = "green" | "yellow" | "red";

export interface OrganSignal {
  organ: string;
  severity: "low" | "moderate" | "high";
  color: RiskColor;
  explanation: string;
  /**
   * Message key for `explanation`, and the values it quotes. The rule catalog
   * lives on the API; its wording lives in the console dictionaries, so a
   * stored analysis follows the language switch instead of staying in the
   * language it was written in.
   */
  explanationKey?: string;
  explanationVars?: Record<string, string | number>;
  missingData: string[];
  /** Values the rule actually read, so a finding can be checked against data. */
  observed?: Array<{ field: string; label?: string; value: number; unit?: string }>;
  /** Deterministic follow-up note from the rule catalog. */
  monitoring?: string;
  /** Message key for `monitoring`, for the same reason. */
  monitoringKey?: string;
  /** Catalog code of the rule that raised this signal. */
  ruleCode?: string;
  /**
   * Evidence grade behind the signal (technical mission §5). Defaults to
   * `projection` so an unlabelled signal is never shown as a verified fact.
   */
  evidence?: EvidenceGrade;
}

export type EvidenceGrade =
  | "verified"
  | "ai_unverified"
  | "clinical_rule"
  | "ai_interpretation"
  | "projection";
