import { Schema, model, Types } from "mongoose";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isEmergencyFlag?: boolean;
  createdAt: Date;
}

export interface ChatConversationDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  patientId?: Types.ObjectId;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const chatConversationSchema = new Schema<ChatConversationDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    patientId: { type: Schema.Types.ObjectId, ref: "PatientProfile" },
    messages: [
      {
        role: { type: String, enum: ["user", "assistant"] },
        content: String,
        isEmergencyFlag: Boolean,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const ChatConversation = model<ChatConversationDoc>("ChatConversation", chatConversationSchema);
