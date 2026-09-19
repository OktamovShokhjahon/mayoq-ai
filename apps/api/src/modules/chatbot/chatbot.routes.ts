import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { createConversation, sendChatMessage } from "./chatbot.service";

export const chatbotRouter = Router();
const chatRateLimit = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

chatbotRouter.use(requireAuth);

chatbotRouter.post("/conversations", async (req, res, next) => {
  try {
    const conversation = await createConversation(req.auth!.tenantId, req.auth!.userId);
    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
});

const messageSchema = z.object({
  message: z.string().min(1).max(4000),
  /** The console's language: what to answer in when the message itself is ambiguous. */
  language: z.enum(["en", "ru", "uz"]).optional(),
});

chatbotRouter.post("/conversations/:conversationId/messages", chatRateLimit, async (req, res, next) => {
  try {
    const input = messageSchema.parse(req.body);
    const result = await sendChatMessage({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      role: req.auth!.role,
      conversationId: req.params.conversationId,
      message: input.message,
      language: input.language,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
