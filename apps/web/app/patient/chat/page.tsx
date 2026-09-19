"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell, PATIENT_NAV } from "@/components/ui/app-shell";
import { api } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isEmergencyFlag?: boolean;
}

interface Conversation {
  _id: string;
  messages: ChatMessage[];
}

export default function PatientChatPage() {
  const { t, locale } = useI18n();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.post<Conversation>("/chat/conversations").then((c) => setConversationId(c._id));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || !conversationId) return;
    const userMessage = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMessage }]);
    setSending(true);
    try {
      const result = await api.post<{ conversation: Conversation }>(`/chat/conversations/${conversationId}/messages`, {
        message: userMessage,
        // What to answer in when the message itself does not say — a one-word
        // reply, a number, a name.
        language: locale,
      });
      setMessages(result.conversation.messages);
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell role="PATIENT" navItems={PATIENT_NAV}>
      <h1 className="mb-2 text-2xl font-semibold text-ink">{t("pc.title")}</h1>
      <p className="mb-4 text-xs text-ink-faint">
        {t("pc.disclaimer")}
      </p>
      <div className="panel flex h-[60vh] flex-col p-4">
        <div className="flex-1 space-y-3 overflow-y-auto pr-2">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-electric/10 text-ink"
                  : m.isEmergencyFlag
                  ? "bg-state-red/20 text-state-red"
                  : "bg-ink/[0.04] text-ink"
              }`}
            >
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("pc.placeholder")}
            className="flex-1 rounded-lg border border-[color:var(--line)] bg-ink/[0.04] px-3 py-2 text-ink"
          />
          <button
            onClick={send}
            disabled={sending || !conversationId}
            className="rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t("pc.send")}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
