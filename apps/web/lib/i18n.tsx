"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { uz, type MessageKey } from "./locales/uz";
import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { bindFormatLocale } from "./format";

export type Locale = "uz" | "en" | "ru";

/** Uzbek first: this is built for Uzbek clinics, so it is the default, not a fallback. */
export const LOCALES: Locale[] = ["uz", "en", "ru"];
export const DEFAULT_LOCALE: Locale = "uz";

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { uz, en, ru };

/** BCP-47 tags for the `lang` attribute, so screen readers pick the right voice. */
const HTML_LANG: Record<Locale, string> = { uz: "uz-Latn", en: "en", ru: "ru" };

const STORAGE_KEY = "mayoq-locale";

/**
 * Runs before first paint so `lang` is correct for the very first render. It
 * does not swap any text — the dictionaries are React state — it only makes
 * the document describe itself honestly before hydration.
 */
export const localeBootScript = `(function(){try{var l=localStorage.getItem("${STORAGE_KEY}");var m={uz:"uz-Latn",en:"en",ru:"ru"};if(m[l]){document.documentElement.lang=m[l]}}catch(e){}})();`;

export function isLocale(value: unknown): value is Locale {
  return value === "uz" || value === "en" || value === "ru";
}

type Vars = Record<string, string | number>;

interface I18nValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** Looks up a message, substituting {name} placeholders. */
  t: (key: MessageKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // The server renders the default, and the stored choice is applied on mount,
  // so both renders agree and hydration stays clean.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) setLocaleState(stored);
    } catch {
      // Blocked storage: the session still works, it just starts in Uzbek.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies to this tab; it just will not be remembered.
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => {
      const dictionary = DICTIONARIES[locale];
      // Falling back to Uzbek rather than to the raw key: a clinician should
      // never be shown `prevention.heading` because one string was missed.
      return format(dictionary[key] ?? uz[key] ?? key, vars);
    },
    [locale]
  );

  // Dates, relative times and clinical field names are formatted outside React
  // by `lib/format`. Binding here rather than in each caller means the whole
  // console — including text a component renders from a helper — switches
  // together, instead of leaving English dates under Uzbek headings.
  //
  // Bound during render, not in an effect: a child rendering in the same pass
  // would otherwise format its first output with the previous locale.
  bindFormatLocale(HTML_LANG[locale], t as (key: string) => string);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
