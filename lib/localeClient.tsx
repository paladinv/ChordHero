"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import english from "./locales/en.json";
import type { MessageKey } from "./localization";
export type { MessageKey } from "./localization";

export const LANGUAGE_OPTIONS = [
  ["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["it", "Italiano"],
  ["pt", "Português"], ["nl", "Nederlands"], ["pl", "Polski"], ["ru", "Русский"], ["uk", "Українська"],
  ["tr", "Türkçe"], ["ar", "العربية"], ["he", "עברית"], ["hi", "हिन्दी"], ["bn", "বাংলা"], ["ur", "اردو"],
  ["id", "Bahasa Indonesia"], ["vi", "Tiếng Việt"], ["th", "ไทย"], ["ja", "日本語"], ["ko", "한국어"],
  ["zh-CN", "简体中文"], ["zh-TW", "繁體中文"]
] as const;

export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number][0];
export type LocalePreference = LanguageCode | "auto";
export const LOCALE_STORAGE_KEY = "chord-hero:display-language:v1";
export const LANGUAGE_OPTIONS_LABELS: Record<LanguageCode, string> = Object.fromEntries(LANGUAGE_OPTIONS) as Record<LanguageCode, string>;


type BrowserCatalog = { messages: Record<string, string> };
const catalogs = new Map<LanguageCode, BrowserCatalog>([["en", english]]);
const pending = new Map<LanguageCode, Promise<BrowserCatalog>>();
const loaders: Record<Exclude<LanguageCode, "en">, () => Promise<BrowserCatalog>> = {
  "es": () => import("./locales/es.json").then((module) => module.default),
  "fr": () => import("./locales/fr.json").then((module) => module.default),
  "de": () => import("./locales/de.json").then((module) => module.default),
  "it": () => import("./locales/it.json").then((module) => module.default),
  "pt": () => import("./locales/pt.json").then((module) => module.default),
  "nl": () => import("./locales/nl.json").then((module) => module.default),
  "pl": () => import("./locales/pl.json").then((module) => module.default),
  "ru": () => import("./locales/ru.json").then((module) => module.default),
  "uk": () => import("./locales/uk.json").then((module) => module.default),
  "tr": () => import("./locales/tr.json").then((module) => module.default),
  "ar": () => import("./locales/ar.json").then((module) => module.default),
  "he": () => import("./locales/he.json").then((module) => module.default),
  "hi": () => import("./locales/hi.json").then((module) => module.default),
  "bn": () => import("./locales/bn.json").then((module) => module.default),
  "ur": () => import("./locales/ur.json").then((module) => module.default),
  "id": () => import("./locales/id.json").then((module) => module.default),
  "vi": () => import("./locales/vi.json").then((module) => module.default),
  "th": () => import("./locales/th.json").then((module) => module.default),
  "ja": () => import("./locales/ja.json").then((module) => module.default),
  "ko": () => import("./locales/ko.json").then((module) => module.default),
  "zh-CN": () => import("./locales/zh-CN.json").then((module) => module.default),
  "zh-TW": () => import("./locales/zh-TW.json").then((module) => module.default),
};
function loadCatalog(language: LanguageCode): Promise<BrowserCatalog> {
  const cached = catalogs.get(language); if (cached) return Promise.resolve(cached);
  const existing = pending.get(language); if (existing) return existing;
  if (language === "en") return Promise.resolve(english);
  const request = loaders[language]().then((catalog) => { catalogs.set(language, catalog); pending.delete(language); return catalog; }, (error) => { pending.delete(language); throw error; });
  pending.set(language, request); return request;
}
function getMessage(language: LanguageCode, key: MessageKey) { return catalogs.get(language)?.messages[key] ?? english.messages[key] ?? key; }
const textKeys = new Map(Object.entries(english.textKeys) as [string, MessageKey][]);
/** Uses the same exact-phrase priority as the complete synchronous catalog API. */
export function translateCatalogText(language: LanguageCode, text: string): string {
  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  const phrase = text.slice(leading.length, text.length - trailing.length || undefined);
  const key = textKeys.get(phrase);
  return key ? `${leading}${getMessage(language, key)}${trailing}` : text;
}

export function normalizeLanguage(tag: string | undefined | null): LanguageCode {
  if (!tag) return "en";
  const normalized = tag.replace(/_/g, "-");
  if (/^zh-(tw|hk|mo|hant)(-|$)/i.test(normalized)) return "zh-TW";
  if (/^zh-(cn|sg|hans)(-|$)/i.test(normalized) || /^zh$/i.test(normalized)) return "zh-CN";
  const language = normalized.split("-")[0].toLowerCase();
  return LANGUAGE_OPTIONS.find(([code]) => code.toLowerCase() === language)?.[0] ?? "en";
}

export function detectLanguage(preferred: readonly string[]): LanguageCode {
  for (const tag of preferred) {
    const result = normalizeLanguage(tag);
    if (tag && (result !== "en" || /^en(?:-|$)/i.test(tag))) return result;
  }
  return "en";
}
export function isRightToLeft(language: LanguageCode) { return language === "ar" || language === "he" || language === "ur"; }

export type TranslationValues = Record<string, string | number>;
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
function interpolate(message: string, values: TranslationValues = {}) {
  return message.replace(/\{([a-zA-Z][\w]*)\}/g, (match, name: string) => String(values[name] ?? match));
}
export function formatPlural(language: LanguageCode, count: number, forms: PluralForms, values: TranslationValues = {}) {
  const category = new Intl.PluralRules(language).select(count);
  return interpolate(forms[category] ?? forms.other, { count, ...values });
}

type LocaleContextValue = {
  language: LanguageCode; preference: LocalePreference; setPreference: (value: LocalePreference) => void;
  t: (key: MessageKey, values?: TranslationValues) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number, maximumFractionDigits?: number) => string;
  formatDuration: (seconds: number) => string;
};
const LocaleContext = createContext<LocaleContextValue>({
  language: "en", preference: "auto", setPreference: () => undefined,
  t: (key, values) => interpolate(getMessage("en", key), values),
  formatDate: (date, options) => new Intl.DateTimeFormat("en", options).format(date),
  formatNumber: (number, options) => new Intl.NumberFormat("en", options).format(number),
  formatPercent: (number, maximumFractionDigits = 0) => new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits }).format(number),
  formatDuration: (seconds) => new Intl.NumberFormat("en", { style: "unit", unit: "second", unitDisplay: "short" }).format(seconds)
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>("auto");
  const [detected, setDetected] = useState<LanguageCode>("en");
  const [language, setLanguage] = useState<LanguageCode>("en");
  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(LOCALE_STORAGE_KEY); } catch { /* Device language remains available without storage. */ }
    if (stored === "auto" || LANGUAGE_OPTIONS.some(([code]) => code === stored)) setPreferenceState(stored as LocalePreference);
    const updateDevice = () => setDetected(detectLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]));
    updateDevice(); window.addEventListener("languagechange", updateDevice);
    return () => window.removeEventListener("languagechange", updateDevice);
  }, []);
  const setPreference = useCallback((value: LocalePreference) => {
    setPreferenceState(value);
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, value); } catch { /* Keep the live selection when storage is unavailable. */ }
  }, []);
  const requested = preference === "auto" ? detected : preference;
  useEffect(() => {
    let cancelled = false;
    void loadCatalog(requested).then(() => { if (!cancelled) setLanguage(requested); }).catch(() => { /* Retain the complete current language if a language download fails. */ });
    return () => { cancelled = true; };
  }, [requested]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRightToLeft(language) ? "rtl" : "ltr";
  }, [language]);
  const value = useMemo(() => ({
    language, preference, setPreference,
    t: (key: MessageKey, values?: TranslationValues) => interpolate(getMessage(language, key), values),
    formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => formatDate(date, language, options),
    formatNumber: (number: number, options?: Intl.NumberFormatOptions) => formatNumber(number, language, options),
    formatPercent: (number: number, maximumFractionDigits = 0) => formatPercent(number, language, maximumFractionDigits),
    formatDuration: (seconds: number) => formatDuration(seconds, language)
  }), [language, preference, setPreference]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() { return useContext(LocaleContext); }
export function formatDate(date: Date, language: LanguageCode, options?: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat(language, options).format(date); }
export function formatNumber(value: number, language: LanguageCode, options?: Intl.NumberFormatOptions) { return new Intl.NumberFormat(language, options).format(value); }
export function formatPercent(value: number, language: LanguageCode, maximumFractionDigits = 0) { return new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits }).format(value); }
export function formatDuration(seconds: number, language: LanguageCode) { return new Intl.NumberFormat(language, { style: "unit", unit: "second", unitDisplay: "short" }).format(seconds); }
