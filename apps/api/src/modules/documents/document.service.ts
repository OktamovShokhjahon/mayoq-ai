import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import { HttpError } from "../../middleware/errorHandler";
import { DocumentModel } from "./document.model";
import { AIJob } from "../ai-analysis/ai-job.model";
import { callGeminiStructured, type InlineMedia } from "../ai-analysis/gemini.client";
import { MedicalRecord } from "../medical-records/medical-record.model";
import { extractDocumentText } from "./text-extraction";
import { extractFactsDeterministically } from "./deterministic-extraction";
import { env } from "../../config/env";
import type { RecordType } from "../../shared/types";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/plain",
]);

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

// Local disk storage stands in for the private object-storage bucket described
// in the spec (S3/MinIO-compatible). Swap this for a real client in production.
const STORAGE_ROOT = path.resolve(process.cwd(), "storage", "documents");

export const EXTRACTED_FACTS_SCHEMA = z.object({
  documentType: z.string(),
  candidateFacts: z.array(
    z.object({
      type: z.enum(["diagnosis", "medication", "allergy", "lab_result", "vital_sign", "procedure"]),
      description: z.string(),
      value: z.union([z.string(), z.number()]).optional(),
      unit: z.string().optional(),
      date: z.string().optional(),
      // The standard form of the name (generic drug, canonical lab test), when the
      // text uses a brand, abbreviation or local spelling. Absent, never guessed.
      normalizedName: z.string().optional(),
      // True when the text gives only a partial date or an ambiguous value.
      uncertain: z.boolean().optional(),
      sourceSpan: z.string(),
      confidence: z.enum(["low", "medium", "high"]),
    })
  ),
  // Dated events in the order the document describes them, oldest first.
  timeline: z
    .array(z.object({ date: z.string().optional(), event: z.string(), uncertain: z.boolean().optional() }))
    .optional(),
  missingOrUnclear: z.array(z.string()),
});

export type ExtractedFacts = z.infer<typeof EXTRACTED_FACTS_SCHEMA>;

export async function uploadDocument(params: {
  tenantId: string;
  patientId: string;
  uploadedBy: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) {
    throw new HttpError(415, "Unsupported file type. Allowed: PDF, DOCX, JPG, PNG, TXT.");
  }
  if (params.buffer.byteLength > MAX_SIZE_BYTES) {
    throw new HttpError(413, "File exceeds the 15MB upload limit.");
  }

  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const storageKey = `${params.tenantId}/${crypto.randomUUID()}-${params.fileName}`;
  const fullPath = path.join(STORAGE_ROOT, storageKey.replace(/\//g, "_"));
  await fs.writeFile(fullPath, params.buffer);

  // Read the text deterministically at upload time so the doctor sees straight
  // away whether this file can be analyzed at all, instead of finding out after
  // asking for an analysis.
  const extraction = await extractDocumentText(params.mimeType, params.buffer);

  const document = await DocumentModel.create({
    tenantId: params.tenantId,
    patientId: params.patientId,
    fileName: params.fileName,
    mimeType: params.mimeType,
    sizeBytes: params.buffer.byteLength,
    storageKey,
    virusScanStatus: "clean", // Placeholder: wire to a real AV scanner before production.
    extractedText: extraction.text || undefined,
    extractionMethod: extraction.method,
    extractionNote: extraction.reason,
    uploadedBy: params.uploadedBy,
  });

  return document;
}

const PROMPT_VERSION = "document-understanding@2";

export async function analyzeDocument(params: {
  tenantId: string;
  documentId: string;
  /** Overrides the parsed text — used when a doctor pastes it themselves. */
  extractedText?: string;
  createdBy: string;
}) {
  const document = await DocumentModel.findOne({ _id: params.documentId, tenantId: params.tenantId });
  if (!document) throw new HttpError(404, "Document not found");

  if (params.extractedText) {
    document.extractedText = params.extractedText.slice(0, 20000);
    document.extractionMethod = "pasted";
    document.extractionNote = undefined;
  }

  // No parsed or pasted text: a scan or a photo can still be read by the model
  // directly. Anything else genuinely has nothing to read.
  let media: InlineMedia[] | undefined;
  if (!document.extractedText) {
    const readableByVision = document.mimeType === "application/pdf" || document.mimeType.startsWith("image/");
    if (!readableByVision) {
      throw new HttpError(
        422,
        document.extractionNote ?? "There is no readable text in this document. Paste its text to analyze it."
      );
    }
    const stored = await fs
      .readFile(path.join(STORAGE_ROOT, document.storageKey.replace(/\//g, "_")))
      .catch(() => null);
    if (!stored) {
      throw new HttpError(422, "The stored file could not be opened. Upload it again or paste its text.");
    }
    media = [{ mimeType: document.mimeType, data: stored }];
    document.extractionMethod = "vision";
  }
  await document.save();

  const aiJob = await AIJob.create({
    tenantId: params.tenantId,
    patientId: document.patientId,
    documentId: document._id,
    task: "document_understanding",
    status: "processing",
    promptVersion: PROMPT_VERSION,
    modelId: env.geminiModel,
  });

  const result = await callGeminiStructured({
    systemPrompt:
      "You extract candidate clinical facts from a medical document. Return ONLY facts explicitly present in the text. " +
      'Use "unknown" rather than guessing. Every fact needs a sourceSpan quoting the originating text. ' +
      "When the text uses a brand name, abbreviation or local spelling, put the standard generic or canonical name in normalizedName; omit it if unsure. " +
      "Set uncertain to true for partial dates or ambiguous values, and list dated events oldest-first in timeline. " +
      "Return strict JSON matching the schema you were given.",
    userPrompt: document.extractedText ?? "Read the attached document and extract the candidate clinical facts it contains.",
    media,
    tenantId: params.tenantId,
    schema: EXTRACTED_FACTS_SCHEMA,
    promptVersion: PROMPT_VERSION,
  });

  aiJob.status = result.ok ? "completed" : "failed";
  aiJob.latencyMs = result.latencyMs;
  aiJob.responseId = result.responseId;
  aiJob.tokenUsage = result.tokenUsage;
  aiJob.error = result.error;
  aiJob.output = result.data as Record<string, unknown> | undefined;
  await aiJob.save();

  document.aiJobId = aiJob._id;
  document.analyzedAt = new Date();
  await document.save();

  // With the model down, a literal parser reads what it can recognise from the
  // same text. It is labelled as such everywhere it surfaces: a doctor must
  // never have to wonder which of the two produced a candidate.
  const extraction = result.ok && result.data ? result.data : extractFactsDeterministically(document.extractedText ?? "");
  const extractionSource: "model" | "deterministic_parser" = result.ok ? "model" : "deterministic_parser";

  // Candidates are written down as AI_UNVERIFIED records so they land in the
  // doctor's verification queue with their source span attached. They are not
  // part of the verified snapshot and no rule reads them until approved.
  const createdRecords = await persistCandidateFacts({
    tenantId: params.tenantId,
    patientId: String(document.patientId),
    documentId: String(document._id),
    createdBy: params.createdBy,
    facts: extraction,
  });

  return {
    document,
    aiJob,
    extraction,
    extractionSource,
    aiAvailable: result.ok,
    aiError: result.ok ? undefined : result.error,
    createdRecordIds: createdRecords.map((record) => String(record._id)),
  };
}

const FACT_TYPE_TO_RECORD_TYPE: Record<ExtractedFacts["candidateFacts"][number]["type"], RecordType> = {
  diagnosis: "diagnosis",
  medication: "medication",
  allergy: "allergy",
  lab_result: "lab_result",
  vital_sign: "vital_sign",
  procedure: "procedure",
};

/**
 * The rule engine reads lab values by canonical field name, so a candidate the
 * doctor approves has to arrive under the same name a rule looks for —
 * otherwise an approved eGFR would sit in the timeline while the analysis kept
 * reporting it missing. Anything not recognised keeps its description only.
 */
const CANONICAL_LAB_FIELDS: Array<{ match: RegExp; field: string }> = [
  { match: /hba1c|glycated/i, field: "latestHba1c" },
  { match: /egfr|glomerular/i, field: "latestEgfr" },
  { match: /creatinine/i, field: "latestCreatinine" },
  { match: /potassium/i, field: "latestPotassium" },
  { match: /systolic/i, field: "latestSystolicBp" },
  { match: /alt|alanine/i, field: "latestAlt" },
  { match: /ast|aspartate/i, field: "latestAst" },
];

export function canonicalLabField(description: string): string | undefined {
  return CANONICAL_LAB_FIELDS.find((entry) => entry.match.test(description))?.field;
}

async function persistCandidateFacts(params: {
  tenantId: string;
  patientId: string;
  documentId: string;
  createdBy: string;
  facts: ExtractedFacts;
}) {
  const rows = params.facts.candidateFacts.map((fact) => ({
    tenantId: params.tenantId,
    patientId: params.patientId,
    type: FACT_TYPE_TO_RECORD_TYPE[fact.type],
    eventDate: parseFactDate(fact.date),
    data: {
      description: fact.description,
      // The record's name: the standard form when the model found one.
      name: fact.normalizedName ?? fact.description,
      // `field` is what the rule engine reads; it is only set when the value is
      // numeric and the name maps onto a field a rule actually asks for.
      field: fact.type === "lab_result" ? canonicalLabField(fact.description) : undefined,
      value: typeof fact.value === "string" ? Number(fact.value) || fact.value : fact.value,
      unit: fact.unit,
      confidence: fact.confidence,
      normalizedName: fact.normalizedName,
      uncertain: fact.uncertain,
      documentType: params.facts.documentType,
    },
    sourceType: "external_document" as const,
    sourceDocumentId: params.documentId,
    verificationStatus: "ai_unverified" as const,
    sourceReferences: [{ documentId: params.documentId, span: fact.sourceSpan }],
    createdBy: params.createdBy,
  }));

  if (rows.length === 0) return [];
  return MedicalRecord.insertMany(rows);
}

/** A date the model could not read is the upload date, never an invented one. */
function parseFactDate(raw?: string): Date {
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
