import { z } from "zod";
import { logger } from "../../config/logger";
import { callGeminiStructured } from "../ai-analysis/gemini.client";
import { languageName } from "../ai-analysis/language";
import { DrugReference, type DrugReferenceDoc, type DrugReferenceSection } from "./drug-reference.model";

/**
 * Medicine reference lookup.
 *
 * Drug facts are fetched from public medicines APIs and shown with their
 * source, never recalled from the language model. Technical mission §5 forbids
 * the AI inventing drug choices or contraindications, and §9.4 requires
 * citations — so the model's only job here is to condense text that was
 * actually retrieved. If the lookup fails, the doctor is told the reference is
 * unavailable rather than shown something plausible.
 */

const OPENFDA_LABEL = "https://api.fda.gov/drug/label.json";
const RXNORM_RXCUI = "https://rxnav.nlm.nih.gov/REST/rxcui.json";

/** Cache window: labels change rarely, and this keeps us off the rate limit. */
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const FETCH_TIMEOUT_MS = 8000;

/** Label fields worth a clinician's attention, in the order they should read. */
// `key` names the openFDA field and, as `drug.section.<key>`, the message key
// the console heads the section with.
const LABEL_FIELDS: Array<{ key: string; heading: string }> = [
  { key: "boxed_warning", heading: "Boxed warning" },
  { key: "indications_and_usage", heading: "Indications and usage" },
  { key: "dosage_and_administration", heading: "Dosage and administration" },
  { key: "contraindications", heading: "Contraindications" },
  { key: "warnings_and_cautions", heading: "Warnings and cautions" },
  { key: "drug_interactions", heading: "Drug interactions" },
  { key: "use_in_specific_populations", heading: "Use in specific populations" },
];

const MAX_SECTION_CHARS = 1400;

const SUMMARY_SCHEMA = z.object({
  summary: z.string(),
  keyCautions: z.array(z.string()).max(6),
});

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    logger.warn({ err, url }, "Drug reference lookup failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  if (typeof value === "string") return value;
  return undefined;
}

function truncate(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_SECTION_CHARS) return clean;
  return clean.slice(0, MAX_SECTION_CHARS).trimEnd() + "...";
}

async function lookupRxNorm(name: string): Promise<string | undefined> {
  const payload = (await fetchJson(
    RXNORM_RXCUI + "?name=" + encodeURIComponent(name) + "&search=2",
  )) as { idGroup?: { rxnormId?: string[] } } | null;
  return payload?.idGroup?.rxnormId?.[0];
}

/** Splits a label's generic name into its active ingredients. */
function ingredientsOf(genericName: string): string[] {
  return genericName
    .toLowerCase()
    .split(/\s+and\s+|,\s*|\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Scores how well a label's generic name matches what was typed. Lower is
 * better.
 *
 * openFDA happily answers a single-ingredient search with a combination
 * product — "metformin" can return a sitagliptin/metformin label, and
 * "atorvastatin" an amlodipine/atorvastatin one. Reading a combination's label
 * for one of its ingredients is a real clinical error, so ingredient count
 * dominates the score: a single-ingredient product always beats a combination,
 * and only then does the closeness of the name break the tie.
 */
function matchScore(label: Record<string, unknown>, name: string): number {
  const openfda = (label.openfda ?? {}) as Record<string, unknown>;
  const generic = (firstString(openfda.generic_name) ?? "").toLowerCase();
  if (!generic) return 100000;
  if (generic === name) return 0;

  const ingredients = ingredientsOf(generic);
  const mentions =
    ingredients.some((part) => part === name || part.includes(name)) || generic.includes(name);
  if (!mentions) return 100000;

  return ingredients.length * 1000 + generic.length;
}

/**
 * True when the matched label really is about the medicine that was typed, and
 * not a combination that merely contains it.
 */
function isExactMatch(genericName: string | undefined, name: string): boolean {
  if (!genericName) return true;
  const ingredients = ingredientsOf(genericName);
  if (ingredients.length !== 1) return false;
  return ingredients[0] === name || ingredients[0].includes(name);
}

async function lookupOpenFda(name: string): Promise<Record<string, unknown> | null> {
  // Generic name first, then brand and substance: a doctor may type any of them.
  const queries = [
    'openfda.generic_name:"' + name + '"',
    'openfda.brand_name:"' + name + '"',
    'openfda.substance_name:"' + name + '"',
  ];

  for (const query of queries) {
    const payload = (await fetchJson(
      OPENFDA_LABEL + "?search=" + encodeURIComponent(query) + "&limit=10",
    )) as { results?: Array<Record<string, unknown>> } | null;

    const results = payload?.results ?? [];
    if (results.length === 0) continue;

    return [...results].sort((a, b) => matchScore(a, name) - matchScore(b, name))[0];
  }
  return null;
}

async function condense(
  name: string,
  sections: Array<{ heading: string; text: string }>,
  language?: string,
): Promise<{ summary: string; keyCautions: string[] } | null> {
  const result = await callGeminiStructured({
    systemPrompt:
      "You condense official medicine label text for a clinician. You may ONLY use the label text provided. " +
      "Never add a dose, threshold, interaction or contraindication that is not present in the supplied text. " +
      "If the text does not cover something, leave it out. Do not give a recommendation. " +
      `Write the summary and the cautions in ${languageName(language)}; keep drug names, dose units and lab names exactly as the label spells them. ` +
      'Return strict JSON: {"summary": string, "keyCautions": string[]}.',
    userPrompt: JSON.stringify({ medicine: name, labelSections: sections }),
    schema: SUMMARY_SCHEMA,
    promptVersion: "drug-reference-condense@1",
    temperature: 0.1,
    language,
  });

  if (!result.ok || !result.data) return null;
  // The cautions travel as a list rather than glued onto the summary under an
  // English heading: the console heads them in the language it is running in.
  return { summary: result.data.summary, keyCautions: result.data.keyCautions.filter(Boolean) };
}

export interface DrugReferenceResult {
  query: string;
  found: boolean;
  rxcui?: string;
  genericName?: string;
  brandNames: string[];
  sections: Array<{ heading: string; text: string }>;
  sources: Array<{ name: string; url: string }>;
  plainSummary?: string;
  keyCautions: string[];
  /** False when the label found covers more than the medicine that was typed. */
  exactMatch: boolean;
  fetchedAt: string;
  cached: boolean;
  notice: string;
  /** `notice` as a key and its values, so the console can say it in its own words. */
  noticeKey: string;
  noticeVars?: Record<string, string | number>;
}

function toResult(doc: DrugReferenceDoc, query: string, cached: boolean): DrugReferenceResult {
  return {
    query,
    found: doc.found,
    rxcui: doc.rxcui,
    genericName: doc.genericName,
    brandNames: doc.brandNames,
    sections: doc.sections,
    sources: doc.sources,
    plainSummary: doc.plainSummary,
    keyCautions: doc.keyCautions ?? [],
    exactMatch: doc.exactMatch !== false,
    fetchedAt: doc.fetchedAt.toISOString(),
    cached,
    noticeKey: !doc.found
      ? "drug.notice.none"
      : doc.exactMatch === false
        ? "drug.notice.related"
        : "drug.notice.ok",
    noticeVars: doc.found && doc.exactMatch === false ? { generic: doc.genericName ?? "" } : undefined,
    notice: !doc.found
      ? "No label found in the public medicines databases for this name. Check the spelling, or use your own formulary."
      : doc.exactMatch === false
        ? "The closest label found covers " +
          (doc.genericName ?? "a related product") +
          ", not this medicine on its own. Read it with that in mind."
        : "Retrieved from public medicines databases. Verify against your own formulary before prescribing.",
  };
}

export async function getDrugReference(name: string, language?: string): Promise<DrugReferenceResult> {
  const query = name.trim();
  const lookup = query.toLowerCase();
  // The condensed summary is written in the reader's language, so the cache is
  // keyed by language too: one shared document would hand the next reader
  // someone else's language and look like the switch had failed.
  const queryKey = `${lookup}::${language ?? "en"}`;

  const hit = await DrugReference.findOne({ queryKey });
  if (hit && Date.now() - hit.fetchedAt.getTime() < CACHE_TTL_MS) {
    return toResult(hit, query, true);
  }

  const [label, rxcui] = await Promise.all([lookupOpenFda(lookup), lookupRxNorm(lookup)]);

  const sections: DrugReferenceSection[] = [];
  const brandNames: string[] = [];
  let genericName: string | undefined;

  if (label) {
    const openfda = (label.openfda ?? {}) as Record<string, unknown>;
    genericName = firstString(openfda.generic_name);
    const brands = openfda.brand_name;
    if (Array.isArray(brands)) {
      for (const brand of brands.slice(0, 6)) {
        if (typeof brand === "string") brandNames.push(brand);
      }
    }

    for (const field of LABEL_FIELDS) {
      const text = firstString(label[field.key]);
      if (text) sections.push({ heading: field.heading, headingKey: `drug.section.${field.key}`, text: truncate(text) });
    }
  }

  const sources: Array<{ name: string; url: string }> = [];
  if (label) {
    sources.push({
      name: "openFDA drug label (U.S. Food and Drug Administration)",
      url:
        "https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22" +
        encodeURIComponent(lookup) +
        "%22&limit=1",
    });
  }
  if (rxcui) {
    sources.push({
      name: "RxNorm (U.S. National Library of Medicine)",
      url: "https://rxnav.nlm.nih.gov/REST/rxcui/" + rxcui + "/allrelated.json",
    });
  }

  const found = sections.length > 0;
  // A near-miss is worth saying out loud: a combination product's label is not
  // the label for the single ingredient a doctor asked about.
  const exactMatch = isExactMatch(genericName, lookup);
  const condensed = found ? await condense(query, sections, language) : null;

  const doc = await DrugReference.findOneAndUpdate(
    { queryKey },
    {
      $set: {
        queryKey,
        found,
        rxcui,
        genericName,
        brandNames,
        sections,
        sources,
        plainSummary: condensed?.summary,
        keyCautions: condensed?.keyCautions ?? [],
        exactMatch,
        fetchedAt: new Date(),
      },
    },
    { new: true, upsert: true },
  );

  return toResult(doc, query, false);
}
