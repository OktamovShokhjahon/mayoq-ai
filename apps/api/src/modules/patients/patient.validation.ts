import { z } from "zod";

export const createPatientSchema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().min(5).max(40).optional(),
  // The doctor sets this and hands it to the patient; it is never generated
  // here and never echoed back.
  password: z.string().min(10).max(200),
  // Everything below is optional: a patient can be created from name, contact
  // details and a password alone, then filled in later.
  dateOfBirth: z.string().datetime().optional(),
  sex: z.enum(["male", "female", "other", "unknown"]).optional(),
});

export const updatePatientSchema = z.object({
  bloodGroup: z.string().optional(),
  heightCm: z.number().positive().optional(),
  weightKg: z.number().positive().optional(),
  smokingStatus: z.enum(["never", "former", "current", "unknown"]).optional(),
  consentStatus: z.enum(["pending", "granted", "revoked"]).optional(),
  status: z.enum(["INCOMPLETE", "ACTIVE", "NEEDS_REVIEW", "FOLLOW_UP", "ARCHIVED"]).optional(),
  emergencyContact: z.object({ name: z.string(), phone: z.string(), relation: z.string().optional() }).optional(),
});

export const createRecordSchema = z.object({
  type: z.enum([
    "diagnosis",
    "medication",
    "allergy",
    "symptom",
    "lab_result",
    "vital_sign",
    "procedure",
    "document",
    "lifestyle_observation",
  ]),
  eventDate: z.string().datetime(),
  data: z.record(z.unknown()).default({}),
  sourceType: z.enum(["doctor_entry", "external_document", "patient_report", "laboratory", "other"]),
  status: z
    .enum(["unverified", "ai_unverified", "verified", "historical", "resolved", "active", "rejected"])
    .default("unverified"),
  note: z.string().optional(),
});
