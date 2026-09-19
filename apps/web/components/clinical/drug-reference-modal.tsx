"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { EmptyState, Skeleton } from "@/components/ui/console";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { api } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { useClinicalText } from "@/lib/clinical-text";
import { formatDate } from "@/lib/format";

interface DrugReference {
  query: string;
  found: boolean;
  rxcui?: string;
  genericName?: string;
  brandNames: string[];
  sections: Array<{ heading: string; headingKey?: string; text: string }>;
  sources: Array<{ name: string; url: string }>;
  plainSummary?: string;
  /** Pulled out of the summary so the heading above them can be translated. */
  keyCautions?: string[];
  exactMatch: boolean;
  fetchedAt: string;
  cached: boolean;
  notice: string;
  noticeKey?: string;
  noticeVars?: Record<string, string | number>;
}

/**
 * Medicine reference, fetched live from public medicines databases.
 *
 * Everything shown here came from a named source that is linked at the bottom.
 * The plain-language summary is a condensation of that fetched text and nothing
 * else — the model is not asked what it knows about the drug.
 */
export function DrugReferenceModal({
  name,
  open,
  onClose,
}: {
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const text = useClinicalText();
  // The locale is part of the query key as well as the request: the condensed
  // summary is written in it, so a language switch is a different answer.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["drug-reference", name.toLowerCase(), locale],
    queryFn: () => api.get<DrugReference>(`/drug-reference?name=${encodeURIComponent(name)}&lang=${locale}`),
    enabled: open && name.trim().length > 1,
    staleTime: 1000 * 60 * 30,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t("drug.title", { name })}
      description={t("drug.description")}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-[color:var(--line)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
        >
          {t("action.close")}
        </button>
      }
    >
      {isLoading && <Skeleton rows={5} />}

      {isError && (
        <EmptyState
          title={t("drug.lookupFailed")}
          body={t("drug.lookupFailedBody")}
        />
      )}

      {data && !data.found && (
        <EmptyState
          title={t("drug.noLabel")}
          body={text(data.noticeKey, data.notice, data.noticeVars)}
        />
      )}

      {data && data.found && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <ProvenanceChip grade="verified" />
            <span className="readout">
              {t("drug.retrieved", { date: formatDate(data.fetchedAt) })}
              {data.cached ? t("drug.cached") : ""}
            </span>
          </div>

          {/* Reading a combination's label for one ingredient is a real error,
              so a near-miss is called out before anything else on the page. */}
          {!data.exactMatch && (
            <p
              role="alert"
              className="rounded border border-state-amber/40 bg-state-amber/10 px-3 py-2 text-[13px] leading-relaxed text-state-amber"
            >
              {text(data.noticeKey, data.notice, data.noticeVars)}
            </p>
          )}

          {(data.genericName || data.brandNames.length > 0) && (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {data.genericName && (
                <span className="flex flex-col">
                  <span className="readout">{t("drug.genericName")}</span>
                  <span className="text-[14px] text-ink">{data.genericName}</span>
                </span>
              )}
              {data.brandNames.length > 0 && (
                <span className="flex min-w-0 flex-col">
                  <span className="readout">{t("drug.brandNames")}</span>
                  <span className="text-[14px] text-ink">{data.brandNames.join(", ")}</span>
                </span>
              )}
              {data.rxcui && (
                <span className="flex flex-col">
                  <span className="readout">{t("drug.rxcui")}</span>
                  <span className="font-mono text-[13px] tabular-nums text-ink">{data.rxcui}</span>
                </span>
              )}
            </div>
          )}

          {data.plainSummary && (
            <section
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--line)", background: "var(--sunken)" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="readout">{t("drug.inShort")}</span>
                <ProvenanceChip grade="ai_interpretation" />
              </div>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-muted">
                {data.plainSummary}
              </p>
              {data.keyCautions && data.keyCautions.length > 0 && (
                <div className="mt-3">
                  <span className="readout">{t("drug.keyCautions")}</span>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {data.keyCautions.map((caution) => (
                      <li key={caution} className="text-[13px] leading-relaxed text-ink-muted">
                        {caution}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                {t("drug.condensed")}
              </p>
            </section>
          )}

          <div className="flex flex-col gap-4">
            {data.sections.map((section) => (
              <section key={section.heading}>
                <h3 className="readout">{text(section.headingKey, section.heading)}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{section.text}</p>
              </section>
            ))}
          </div>

          <footer className="border-t border-[color:var(--line)] pt-3">
            <span className="readout">{t("drug.sources")}</span>
            <ul className="mt-2 flex flex-col gap-1.5">
              {data.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[12px] text-signal underline decoration-signal/40 underline-offset-2 hover:decoration-signal"
                  >
                    {source.name}
                  </a>
                </li>
              ))}
            </ul>
          </footer>
        </div>
      )}
    </Modal>
  );
}
