import { Schema, model, Types } from "mongoose";
import type { Role } from "../../shared/types";

export interface UserDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  role: Role;
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  status: "active" | "inactive" | "must_change_password";
  tokenVersion: number;
  lastLoginAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    role: { type: String, enum: ["ADMIN", "DOCTOR", "PATIENT"], required: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive", "must_change_password"], default: "active" },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const User = model<UserDoc>("User", userSchema);
