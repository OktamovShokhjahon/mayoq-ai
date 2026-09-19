import { Schema, model, Types } from "mongoose";

export interface DocumentDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  patientId: Types.ObjectId;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  virusScanStatus: "pending" | "clean" | "infected";
  extractedText?: string;
  /** How the text was obtained: a parser, or a person pasting it. */
  extractionMethod?: "pdf_text_layer" | "docx" | "plain_text" | "pasted" | "vision" | "none";
  extractionNote?: string;
  /** Set once a doctor has been offered the extracted candidates. */
  analyzedAt?: Date;
  aiJobId?: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<DocumentDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    storageKey: { type: String, required: true },
    virusScanStatus: { type: String, enum: ["pending", "clean", "infected"], default: "pending" },
    extractedText: { type: String },
    extractionMethod: {
      type: String,
      enum: ["pdf_text_layer", "docx", "plain_text", "pasted", "vision", "none"],
    },
    extractionNote: { type: String },
    analyzedAt: { type: Date },
    aiJobId: { type: Schema.Types.ObjectId, ref: "AIJob" },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const DocumentModel = model<DocumentDoc>("Document", documentSchema);
