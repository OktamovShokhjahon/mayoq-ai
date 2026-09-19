"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, EmptyState, Skeleton } from "@/components/ui/console";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { inputClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { formatDate, formatRelative, humanizeEnum } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";

interface DocumentRow {
  _id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  extractionMethod?: "pdf_text_layer" | "docx" | "plain_text" | "pasted" | "vision" | "none";
  extractionNote?: string;
  analyzedAt?: string;
  createdAt: string;
}

interface CandidateRecord {
  _id: string;
  type: string;
  eventDate: string;
  verificationStatus: string;
  data: { description?: string; value?: number | string; unit?: string; confidence?: string; field?: string; normalizedName?: string; uncertain?: boolean };
  sourceReferences?: Array<{ span?: string }>;
}

const EXTRACTION_LABEL: Record<string, MessageKey> = {
  pdf_text_layer: "di.extract.pdf_text_layer",
  docx: "di.extract.docx",
  plain_text: "di.extract.plain_text",
  pasted: "di.extract.pasted",
  vision: "di.extract.vision",
  none: "di.extract.none",
};

/**
 * Document intake, verification queue and nothing in between. A file is stored,
 * its text is read deterministically where that is possible, candidate facts
 * come back with the line they came from, and every one of them waits here as
 * unverified until a doctor approves it. Nothing on this panel reaches the
 * patient snapshot or a clinical rule before that.
 */
export function DocumentIntake({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState("");
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractionSource, setExtractionSource] = useState<"model" | "deterministic_parser" | null>(null);

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["documents", patientId],
    queryFn: () => api.get<DocumentRow[]>(`/patients/${patientId}/documents`),
  });

  const { data: records } = useQuery({
    queryKey: ["records", patientId],
    queryFn: () => api.get<CandidateRecord[]>(`/patients/${patientId}/records`),
  });

  const pending = (records ?? []).filter((record) => record.verificationStatus === "ai_unverified");

  const analyze = useMutation({
    mutationFn: (params: { documentId: string; text?: string }) =>
      api.post<{ extractionSource: "model" | "deterministic_parser"; createdRecordIds: string[] }>(
        `/documents/${params.documentId}/analyze`,
        params.text ? { extractedText: params.text } : {},
      ),
    onSuccess: (result) => {
      setExtractionSource(result.extractionSource);
      setError(null);
      setPastedText("");
      toast(
        result.createdRecordIds.length > 0
          ? t("di.candidates", { count: result.createdRecordIds.length })
          : t("di.noCandidates"),
        result.createdRecordIds.length > 0 ? "success" : "info",
      );
      queryClient.invalidateQueries({ queryKey: ["records", patientId] });
      queryClient.invalidateQueries({ queryKey: ["documents", patientId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("di.analyzeFailed")),
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.upload<DocumentRow>(`/patients/${patientId}/documents`, file),
    onSuccess: (document) => {
      setError(null);
      setActiveDocumentId(document._id);
      queryClient.invalidateQueries({ queryKey: ["documents", patientId] });
      const readableByVision = document.mimeType === "application/pdf" || document.mimeType.startsWith("image/");
      if ((document.extractionMethod && document.extractionMethod !== "none") || readableByVision) {
        // Either text was parsed from the file or Gemini can read it as an
        // image, so the extraction can run straight away.
        analyze.mutate({ documentId: document._id });
      } else {
        toast(document.extractionNote ?? t("di.pasteToAnalyze"), "info");
      }
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("di.uploadFailed")),
  });

  const exportPdf = useMutation({
    mutationFn: (documentId: string) => api.download(`/documents/${documentId}/export.pdf`, "extraction.pdf"),
    onError: (err) => setError(err instanceof ApiError ? err.message : t("di.exportFailed")),
  });

  const verify = useMutation({
    mutationFn: (params: { recordId: string; approve: boolean }) =>
      api.patch(`/records/${params.recordId}`, { approve: params.approve }),
    onSuccess: (_result, params) => {
      toast(params.approve ? t("di.approved") : t("di.rejected"));
      queryClient.invalidateQueries({ queryKey: ["records", patientId] });
      queryClient.invalidateQueries({ queryKey: ["scenarios", patientId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("di.updateFailed")),
  });

  return (
    <Panel
      title={`${t("di.title")}${pending.length > 0 ? t("di.toVerify", { count: pending.length }) : ""}`}
      className="mt-4"
      action={
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={upload.isPending}
          className="rounded border border-[color:var(--line-strong)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink transition hover:bg-ink/[0.04] disabled:opacity-60"
        >
          {upload.isPending ? t("di.uploading") : t("di.uploadFile")}
        </button>
      }
    >
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.mutate(file);
          event.target.value = "";
        }}
      />

      <p className="max-w-readable text-[13px] leading-relaxed text-ink-muted">
        {t("di.intro")}
      </p>

      {/* ------------------------------------------------------ paste path */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const documentId = activeDocumentId ?? documents?.[0]?._id;
          if (!documentId) {
            setError(t("di.uploadFirst"));
            return;
          }
          analyze.mutate({ documentId, text: pastedText });
        }}
        className="mt-4 flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1.5">
          <span className="readout">{t("di.pasteLabel")}</span>
          <textarea
            rows={3}
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            placeholder={t("di.pastePlaceholder")}
            className={`${inputClass} resize-y font-mono text-[12px]`}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pastedText.trim().length < 10 || analyze.isPending}
            className="rounded bg-ai px-4 py-2 text-sm font-medium text-white transition hover:bg-ai/90 disabled:opacity-50"
          >
            {analyze.isPending ? t("di.extracting") : t("di.extractFacts")}
          </button>
          <span className="text-[12px] text-ink-faint">
            {t("di.attachesTo", {
              target: activeDocumentId
                ? t("di.justUploaded")
                : documents?.[0]?.fileName ?? t("di.anUploadedFile"),
            })}
          </span>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-3 rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-[13px] text-state-red">
          {error}
        </p>
      )}

      {extractionSource === "deterministic_parser" && (
        <p className="mt-3 rounded border border-[color:var(--line-strong)] bg-sunken px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
          {t("di.deterministic")}
        </p>
      )}

      {/* ----------------------------------------------- verification queue */}
      <div className="mt-5">
        <h3 className="readout mb-2">{t("di.awaitingVerification")}</h3>
        <AnimatePresence initial={false}>
          {pending.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {pending.map((record) => (
                <motion.li
                  key={record._id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="rounded border p-3"
                  style={{ borderColor: "color-mix(in srgb, var(--ai) 30%, transparent)", background: "color-mix(in srgb, var(--ai) 4%, transparent)" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] text-ink">
                        {record.data.description ?? humanizeEnum(record.type)}
                        {record.data.value !== undefined && (
                          <span className="ml-2 font-mono tabular-nums text-ink-muted">
                            {record.data.value}
                            {record.data.unit ? ` ${record.data.unit}` : ""}
                          </span>
                        )}
                      </p>
                      {(record.data.normalizedName || record.data.uncertain) && (
                        <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                          {record.data.normalizedName ? t("di.normalizedAs", { name: record.data.normalizedName }) : ""}
                          {record.data.normalizedName && record.data.uncertain ? " · " : ""}
                          {record.data.uncertain ? t("di.uncertain") : ""}
                        </p>
                      )}
                      <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                        {humanizeEnum(record.type)} · {formatDate(record.eventDate)}
                        {record.data.confidence
                          ? t("di.confidence", { level: record.data.confidence })
                          : ""}
                      </p>
                    </div>
                    <ProvenanceChip grade="ai_unverified" />
                  </div>

                  {record.sourceReferences?.[0]?.span && (
                    <blockquote className="mt-2 border-l-2 pl-2.5 font-mono text-[11px] leading-relaxed text-ink-muted" style={{ borderColor: "var(--ai)" }}>
                      “{record.sourceReferences[0].span}”
                    </blockquote>
                  )}

                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      onClick={() => verify.mutate({ recordId: record._id, approve: true })}
                      disabled={verify.isPending}
                      className="rounded border border-state-green/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-state-green transition hover:bg-state-green/10 disabled:opacity-60"
                    >
                      {t("action.approve")}
                    </button>
                    <button
                      onClick={() => verify.mutate({ recordId: record._id, approve: false })}
                      disabled={verify.isPending}
                      className="rounded border border-[color:var(--line-strong)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted transition hover:bg-ink/[0.04] disabled:opacity-60"
                    >
                      {t("action.reject")}
                    </button>
                  </div>
                </motion.li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={t("di.nothingWaiting")}
              body={t("di.nothingWaitingBody")}
            />
          )}
        </AnimatePresence>
      </div>

      {/* --------------------------------------------------------- file list */}
      <div className="mt-5">
        <h3 className="readout mb-2">{t("di.uploadedFiles")}</h3>
        {documentsLoading ? (
          <Skeleton rows={2} />
        ) : documents && documents.length > 0 ? (
          <ul className="flex flex-col divide-y divide-[color:var(--line)]">
            {documents.map((document) => (
              <li key={document._id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-ink">{document.fileName}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                    {Math.max(1, Math.round(document.sizeBytes / 1024))} KB · {formatRelative(document.createdAt)}
                    {document.extractionMethod ? ` · ${t(EXTRACTION_LABEL[document.extractionMethod])}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                {document.analyzedAt && (
                  <button
                    onClick={() => exportPdf.mutate(document._id)}
                    disabled={exportPdf.isPending}
                    className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal hover:underline disabled:text-ink-faint"
                  >
                    {t("di.exportPdf")}
                  </button>
                )}
                <button
                  onClick={() => {
                    setActiveDocumentId(document._id);
                    analyze.mutate({ documentId: document._id });
                  }}
                  disabled={analyze.isPending}
                  className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-signal hover:underline disabled:text-ink-faint"
                >
                  {document.analyzedAt ? t("di.reExtract") : t("di.extractFacts")}
                </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t("di.noDocuments")} body={t("di.noDocumentsBody")} />
        )}
      </div>
    </Panel>
  );
}
