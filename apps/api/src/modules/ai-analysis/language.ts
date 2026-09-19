const NAMES: Record<string, string> = { en: "English", ru: "Russian", uz: "Uzbek (Latin script)" };

/** The interface language a page asked for; unknown codes fall back to English. */
export function languageName(code?: string): string {
  return NAMES[code ?? ""] ?? "English";
}
