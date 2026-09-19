import { Schema, model, Types } from "mongoose";

export interface AIJobDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  patientId: Types.ObjectId;
  documentId?: Types.ObjectId;
  task: "document_understanding" | "entity_normalization" | "timeline" | "treatment_summary" | "missing_data" | "interaction_explanation" | "scenario_narrative" | "chatbot";
  status: "queued" | "processing" | "completed" | "failed";
  promptVersion: string;
  modelId: string;
  responseId?: string;
  latencyMs?: number;
  tokenUsage?: { prompt: number; completion: number };
  error?: string;
  output?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const aiJobSchema = new Schema<AIJobDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: "Document" },
    task: {
      type: String,
      enum: [
        "document_understanding",
        "entity_normalization",
        "timeline",
        "treatment_summary",
        "missing_data",
        "interaction_explanation",
        "scenario_narrative",
        "chatbot",
      ],
      required: true,
    },
    status: { type: String, enum: ["queued", "processing", "completed", "failed"], default: "queued" },
    promptVersion: { type: String, required: true },
    modelId: { type: String, required: true },
    responseId: { type: String },
    latencyMs: { type: Number },
    tokenUsage: { prompt: Number, completion: Number },
    error: { type: String },
    output: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const AIJob = model<AIJobDoc>("AIJob", aiJobSchema);
