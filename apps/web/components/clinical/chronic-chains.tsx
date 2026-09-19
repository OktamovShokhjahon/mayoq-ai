"use client";

import { useQuery } from "@tanstack/react-query";
import { Panel, EmptyState, Skeleton } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { useClinicalText, type ClinicalText } from "@/lib/clinical-text";
import { fieldLabel, fieldList } from "@/lib/format";
import type { MessageKey } from "@/lib/locales/uz";

export type ChainStage = "risk" | "early" | "established";

export interface MatchedChain {
  code: string;
  from: string;
  fromKey?: string;
  to: string;
  toKey?: string;
  organ: string;
  stage: ChainStage;
  mechanism: string;
  mechanismKey?: string;
  because: string;
  /** `because` as a key and its values; `fromKey`/`toKey` inside are keys too. */
  becauseKey?: string;
  becauseVars?: Record<string, string | number>;
  observed?: { field: string; label: string; value: number; unit?: string };
  /** Field name of the reading that would settle the stage. */
  missingMarker?: string;
}

export interface ChainGuidance {
  code: string;
  explanation: string;
  doThis: string[];
  avoidThis: string[];
  seeDoctorIf: string[];
  /**
   * Present only on the catalog fallback. Model-written guidance already
   * arrives in the language the page asked for; the fallback is fixed English
   * held in the API, so it travels as keys and is said here.
   */
  explanationKey?: string;
  doThisKeys?: string[];
  avoidThisKeys?: string[];
  seeDoctorIfKeys?: string[];
}

export interface ChainReport {
  chains: MatchedChain[];
  missingData: string[];
  chainSetVersion: string;
  generatedAt: string;
  patientCode: string;
  intro?: string;
  guidance: ChainGuidance[];
  /** Who wrote the advice on screen: the model, or the reviewed catalog. */
  guidanceSource: "model" | "catalog_fallback";
  ai: { available: boolean; modelId?: string; error?: string };
  disclaimer: string;
}

/**
 * The stage ladder, in order. It is the one piece of ranking on this panel that
 * carries real information: how far along this patient's own record says the
 * chain already is. Colour follows the app's clinical semantics — a
 * complication already on the chart is red, a marker that has moved is amber,
 * a chain that has not started is green — and is never the only signal.
 */
const STAGE: Record<ChainStage, { key: MessageKey; hex: string; glyph: string }> = {
  established: { key: "cc.stage.established", hex: "var(--state-red)", glyph: "●" },
  early: { key: "cc.stage.early", hex: "var(--state-amber)", glyph: "△" },
  risk: { key: "cc.stage.risk", hex: "var(--state-green)", glyph: "○" },
};

function StageChip({ stage }: { stage: ChainStage }) {
  const { t } = useI18n();
  const style = STAGE[stage];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]"
      style={{ color: style.hex, borderColor: "var(--line-strong)" }}
    >
      <span aria-hidden>{style.glyph}</span>
      {t(style.key)}
    </span>
  );
}

/** One side of the do / do-not pair. The glyph carries the meaning without colour. */
function ActionList({
  label,
  glyph,
  items,
  keys,
  tone,
  text,
}: {
  label: string;
  glyph: string;
  items: string[];
  /** Parallel to `items`, when the guidance came from the catalog. */
  keys?: string[];
  tone: string;
  text: ClinicalText;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <span className="readout" style={{ color: tone }}>
        {label}
      </span>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-ink">
            <span aria-hidden className="mt-[1px] shrink-0 font-mono text-[11px]" style={{ color: tone }}>
              {glyph}
            </span>
            {text(keys?.[index], item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChainCard({ chain, guidance }: { chain: MatchedChain; guidance?: ChainGuidance }) {
  const { t } = useI18n();
  const text = useClinicalText();

  const from = text(chain.fromKey, chain.from);
  const to = text(chain.toKey, chain.to);
  // The two condition names go into the sentence already translated, so it
  // does not come out as Uzbek grammar wrapped around English condition names.
  const because = text(chain.becauseKey, chain.because, {
    ...chain.becauseVars,
    from,
    to,
    field: chain.becauseVars?.field ? fieldLabel(String(chain.becauseVars.field)) : "",
  });

  return (
    <article className="panel overflow-hidden">
      <div className="border-b border-[color:var(--line)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* The arrow is the content: this condition leads to that one. */}
          <h3 className="display flex flex-wrap items-baseline gap-2 text-[17px] leading-snug text-ink">
            {from}
            <span aria-hidden className="font-mono text-[15px] text-ink-faint">
              →
            </span>
            <span className="sr-only">{t("cc.leadsTo")}</span>
            {to}
          </h3>
          <StageChip stage={chain.stage} />
        </div>

        <p className="mt-2.5 max-w-readable text-[13px] leading-relaxed text-ink-muted">{because}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {chain.observed && (
            <span
              className="inline-flex items-baseline gap-1.5 rounded border px-2 py-1"
              style={{ borderColor: "var(--line-strong)" }}
            >
              <span className="readout">{fieldLabel(chain.observed.field)}</span>
              <span className="readout-value text-[13px] text-ink">
                {chain.observed.value}
                {chain.observed.unit ? ` ${chain.observed.unit}` : ""}
              </span>
            </span>
          )}
          {chain.missingMarker && (
            <span className="font-mono text-[11px] text-state-amber">
              <span aria-hidden>△ </span>
              {t("cc.missingMarker", { field: fieldLabel(chain.missingMarker) })}
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <span className="readout">{t("cc.why")}</span>
        <p className="mt-2 max-w-readable text-[13.5px] leading-relaxed text-ink">
          {guidance
            ? text(guidance.explanationKey, guidance.explanation)
            : text(chain.mechanismKey, chain.mechanism)}
        </p>

        {guidance && (guidance.doThis.length > 0 || guidance.avoidThis.length > 0) && (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <ActionList
              label={t("cc.do")}
              glyph="✓"
              items={guidance.doThis}
              keys={guidance.doThisKeys}
              tone="var(--state-green)"
              text={text}
            />
            <ActionList
              label={t("cc.avoid")}
              glyph="✕"
              items={guidance.avoidThis}
              keys={guidance.avoidThisKeys}
              tone="var(--state-red)"
              text={text}
            />
          </div>
        )}
      </div>

      {guidance && guidance.seeDoctorIf.length > 0 && (
        <div
          className="border-t p-4"
          style={{
            borderColor: "rgb(var(--rgb-state-red) / 0.4)",
            background: "color-mix(in srgb, var(--state-red) 6%, transparent)",
          }}
        >
          <span className="readout text-state-red">{t("cc.seeDoctor")}</span>
          <ul className="mt-2 flex flex-col gap-1">
            {guidance.seeDoctorIf.map((item, index) => (
              <li key={item} className="text-[13px] leading-relaxed text-ink">
                {text(guidance.seeDoctorIfKeys?.[index], item)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/**
 * Chronic-disease chains for one patient: which condition they already have can
 * lead on to which other, how far their own record says each has moved, and
 * what to do and to avoid for each.
 *
 * The panel keeps the two sources apart on purpose. The links, the stages and
 * the evidence line come from the reviewed catalog over verified data only. The
 * explanation and the do / avoid lists are model-written and unverified, which
 * the footer states plainly. When the model is unavailable the links still
 * stand: only the advice is missing.
 */
export function ChronicChainsPanel({ endpoint }: { endpoint: string }) {
  const { t, locale } = useI18n();
  const report = useQuery({
    queryKey: ["chronic-chains", endpoint, locale],
    queryFn: () =>
      api.get<ChainReport>(`${endpoint}${endpoint.includes("?") ? "&" : "?"}lang=${locale}`),
  });

  if (report.isLoading) return <Skeleton rows={4} />;
  if (report.isError) {
    return <EmptyState title={t("cc.errorTitle")} body={t("cc.errorBody")} />;
  }

  const data = report.data;
  if (!data || data.chains.length === 0) {
    return <EmptyState title={t("cc.noneTitle")} body={t("cc.noneBody")} />;
  }

  const guidanceFor = (code: string) => data.guidance.find((entry) => entry.code === code);

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-readable text-[14px] leading-relaxed text-ink-muted">
        {data.intro ?? t("cc.intro")}
      </p>

      {/* The advice below is still there when the model is down — it comes from
          the reviewed catalog instead. Saying "no advice" over a panel full of
          advice would leave a doctor unsure which of the two they are reading. */}
      {!data.ai.available && (
        <div
          className="panel-sunken p-4"
          style={{ borderColor: "rgb(var(--rgb-state-amber) / 0.4)" }}
        >
          <span className="readout text-state-amber">{t("cc.aiDownTitle")}</span>
          <p className="mt-2 max-w-readable text-[13px] leading-relaxed text-ink-muted">
            {t(data.guidance.length > 0 ? "cc.aiDownFallbackBody" : "cc.aiDownBody")}
          </p>
        </div>
      )}

      {data.chains.map((chain) => (
        <ChainCard key={chain.code} chain={chain} guidance={guidanceFor(chain.code)} />
      ))}

      {data.missingData.length > 0 && (
        <div
          className="panel-sunken p-4"
          style={{ borderColor: "rgb(var(--rgb-state-amber) / 0.4)" }}
        >
          <span className="readout text-state-amber">{t("cc.sharpen")}</span>
          <p className="mt-2 max-w-readable text-[13px] leading-relaxed text-ink-muted">
            {t("cc.sharpenBody", { list: fieldList(data.missingData) })}
          </p>
        </div>
      )}

      <p className="max-w-readable font-mono text-[11px] leading-relaxed text-ink-faint">
        {data.guidanceSource === "model"
          ? t("cc.provenance", {
              version: data.chainSetVersion,
              model: data.ai.modelId ?? t("cc.noModel"),
            })
          : t("cc.provenanceFallback", { version: data.chainSetVersion })}
      </p>
    </div>
  );
}
