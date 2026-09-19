import { Schema, model, Types } from "mongoose";

export interface MedicationDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  patientId: Types.ObjectId;
  genericName: string;
  brandName?: string;
  dosage: number;
  unit: string;
  route: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  status: "active" | "completed" | "discontinued";
  purpose?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const medicationSchema = new Schema<MedicationDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
    genericName: { type: String, required: true },
    brandName: { type: String },
    dosage: { type: Number, required: true },
    unit: { type: String, required: true },
    route: { type: String, required: true },
    frequency: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    status: { type: String, enum: ["active", "completed", "discontinued"], default: "active" },
    purpose: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Medication = model<MedicationDoc>("Medication", medicationSchema);
