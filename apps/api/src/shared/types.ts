export type Role = "ADMIN" | "DOCTOR" | "PATIENT";

export type PatientStatus = "INCOMPLETE" | "ACTIVE" | "NEEDS_REVIEW" | "FOLLOW_UP" | "ARCHIVED";

export type RecordType =
  | "diagnosis"
  | "medication"
  | "allergy"
  | "symptom"
  | "lab_result"
  | "vital_sign"
  | "procedure"
  | "document"
  | "lifestyle_observation";

export type SourceType = "doctor_entry" | "external_document" | "patient_report" | "laboratory" | "other";

export type VerificationStatus = "unverified" | "ai_unverified" | "verified" | "historical" | "resolved" | "active" | "rejected";

export type TreatmentDecisionState = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DISCONTINUED";

export type RiskColor = "green" | "yellow" | "red";

export type AnalysisStatus = "queued" | "processing" | "completed" | "failed" | "stale" | "needs_doctor_review";

export type SubscriptionPlan = "DEMO" | "MONTHLY" | "YEARLY";

export type SubscriptionState = "trialing" | "active" | "past_due" | "canceled" | "expired";

export interface JwtAccessPayload {
  sub: string;
  tenantId: string;
  role: Role;
  tokenVersion: number;
}
