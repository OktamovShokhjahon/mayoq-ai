import { z } from "zod";
import { callGeminiStructured } from "../ai-analysis/gemini.client";
import { languageName } from "../ai-analysis/language";
import { HttpError } from "../../middleware/errorHandler";
import { ChatConversation } from "./chat-conversation.model";
import { PatientProfile } from "../patients/patient.model";
import { Diagnosis } from "../diagnoses/diagnosis.model";
import { Medication } from "../medications/medication.model";

// Emergency wording in every language the interface supports. A patient who
// writes in Russian or Uzbek must trip the same guard as one who writes in
// English; the model is also told to treat any language this way.
const EMERGENCY_PATTERNS = {
  en: /chest pain|difficulty breathing|can't breathe|cannot breathe|severe bleeding|suicidal|loss of consciousness|stroke|numbness on one side|blue lips/i,
  ru: /боль в груди|не могу дышать|трудно дышать|сильное кровотечение|потеря сознания|потерял сознание|инсульт|суицид|онемение (?:с одной стороны|половины)|синие губы/i,
  uz: /ko['ʻ’]?krak og['ʻ’]?rig['ʻ’]?i|nafas ololmayapman|nafas qisil|kuchli qon ketish|hushimdan ketdim|hushidan ketdi|insult|o['ʻ’]?z joniga qasd|lablari ko['ʻ’]?k/i,
} as const;

// Shown in the language the matching pattern belongs to, so the warning is
// readable by the person who needs it.
const EMERGENCY_REPLIES: Record<keyof typeof EMERGENCY_PATTERNS, string> = {
  en: "This may describe a medical emergency. Please contact your local emergency services or go to the nearest emergency department immediately. This chatbot cannot handle emergencies.",
  ru: "Возможно, это неотложное состояние. Немедленно позвоните в скорую помощь или обратитесь в ближайшее отделение неотложной помощи. Этот чат-бот не может помочь при неотложных состояниях.",
  uz: "Bu shoshilinch holat bo'lishi mumkin. Darhol tez yordamga qo'ng'iroq qiling yoki eng yaqin shoshilinch yordam bo'limiga boring. Bu chatbot shoshilinch holatlarda yordam bera olmaydi.",
};

function detectEmergency(message: string): keyof typeof EMERGENCY_PATTERNS | null {
  // Script decides first: Cyrillic text is Russian even if a Latin word matches.
  const order = /[а-яё]/i.test(message) ? (["ru", "en", "uz"] as const) : (["en", "uz", "ru"] as const);
  return order.find((lang) => EMERGENCY_PATTERNS[lang].test(message)) ?? null;
}

// Said in the language the patient is reading the app in. This text is stored
// in the conversation like any other reply, so it has to be right the first
// time: there is no re-rendering it after a language switch.
const UNAVAILABLE: Record<keyof typeof EMERGENCY_PATTERNS, string> = {
  en: "The AI assistant is currently unavailable. Please try again later, or contact your care team directly.",
  ru: "ИИ-помощник сейчас недоступен. Попробуйте позже или обратитесь к своему врачу напрямую.",
  uz: "AI yordamchi hozir mavjud emas. Keyinroq urinib ko'ring yoki to'g'ridan-to'g'ri shifokoringizga murojaat qiling.",
};

function interfaceLanguage(code?: string): keyof typeof EMERGENCY_PATTERNS {
  return code === "ru" || code === "uz" ? code : "en";
}

const HISTORY_TURNS = 6;

const CHAT_RESPONSE_SCHEMA = z.object({
  reply: z.string(),
  isEducationalOnly: z.literal(true),
});

const PROMPT_VERSION = "patient-chatbot@2";

export async function sendChatMessage(params: {
  tenantId: string;
  userId: string;
  role: "PATIENT" | "DOCTOR" | "ADMIN";
  conversationId?: string;
  message: string;
  /** The language the patient is reading the app in. */
  language?: string;
}) {
  const emergencyLang = detectEmergency(params.message);
  if (emergencyLang) {
    const reply = EMERGENCY_REPLIES[emergencyLang];
    const conversation = await appendMessage(params, reply, true);
    return { conversation, isEmergency: true };
  }

  let approvedContext = "";
  if (params.role === "PATIENT") {
    const profile = await PatientProfile.findOne({ userId: params.userId, tenantId: params.tenantId });
    if (profile) {
      const [diagnoses, medications] = await Promise.all([
        Diagnosis.find({ tenantId: params.tenantId, patientId: profile._id, state: "active" }).lean(),
        Medication.find({ tenantId: params.tenantId, patientId: profile._id, status: "active" }).lean(),
      ]);
      approvedContext = JSON.stringify({
        diagnoses: diagnoses.map((d) => d.label),
        medications: medications.map((m) => ({ name: m.genericName, dosage: m.dosage, unit: m.unit, frequency: m.frequency })),
      });
    }
  }

  // The last few turns, so a follow-up like "and when should I take it?" has
  // something to refer to. Emergency replies are left out: they are canned text.
  const previous = params.conversationId
    ? await ChatConversation.findOne({ _id: params.conversationId, tenantId: params.tenantId, userId: params.userId })
    : null;
  const history = (previous?.messages ?? [])
    .filter((m) => !m.isEmergencyFlag)
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content }));

  const result = await callGeminiStructured({
    systemPrompt:
      "You are TwinRx's educational health assistant. You must: " +
      "1) never diagnose or prescribe; 2) never change any medical record; " +
      "3) only use the approved patient context provided, never invent facts; " +
      "4) clearly state you are AI-generated and not a substitute for a clinician; " +
      "5) refuse to reveal information about any other patient; " +
      "6) reply in the same language the user wrote their latest message in, whatever that language is" +
      `, and when that is unclear — a one-word message, a name, a number — reply in ${languageName(params.language)}; ` +
      "7) if the message describes a medical emergency in any language, tell them to contact emergency services now. " +
      'Return strict JSON: {"reply": string, "isEducationalOnly": true}.',
    userPrompt: JSON.stringify({ previousMessages: history, question: params.message, approvedContext }),
    tenantId: params.tenantId,
    schema: CHAT_RESPONSE_SCHEMA,
    promptVersion: PROMPT_VERSION,
    temperature: 0.3,
    language: params.language,
  });

  const reply = result.ok ? result.data!.reply : UNAVAILABLE[interfaceLanguage(params.language)];

  const conversation = await appendMessage(params, reply, false);
  return { conversation, isEmergency: false, aiAvailable: result.ok };
}

async function appendMessage(
  params: { tenantId: string; userId: string; conversationId?: string; message: string },
  reply: string,
  isEmergencyFlag: boolean
) {
  let conversation = params.conversationId
    ? await ChatConversation.findOne({ _id: params.conversationId, tenantId: params.tenantId, userId: params.userId })
    : null;

  if (!conversation) {
    conversation = await ChatConversation.create({ tenantId: params.tenantId, userId: params.userId, messages: [] });
  }
  if (!conversation) throw new HttpError(404, "Conversation not found");

  conversation.messages.push({ role: "user", content: params.message, createdAt: new Date() });
  conversation.messages.push({ role: "assistant", content: reply, isEmergencyFlag, createdAt: new Date() });
  await conversation.save();
  return conversation;
}

export async function createConversation(tenantId: string, userId: string) {
  return ChatConversation.create({ tenantId, userId, messages: [] });
}
