import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const baseRequire = createRequire(path.join(root, "package.json"));
const pageCopySource = fs.readFileSync(path.join(root, "lib/pageCopy.ts"), "utf8");
const pageCopyCompiled = ts.transpileModule(pageCopySource, {
  fileName: "pageCopy.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const pageCopyModule = { exports: {} };
new Function("module", "exports", pageCopyCompiled)(pageCopyModule, pageCopyModule.exports);
const uiCopySource = fs.readFileSync(path.join(root, "lib/uiCopy.ts"), "utf8");
const uiCopyCompiled = ts.transpileModule(uiCopySource, {
  fileName: "uiCopy.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const uiCopyModule = { exports: {} };
new Function("module", "exports", uiCopyCompiled)(uiCopyModule, uiCopyModule.exports);
const uiCopyExtraSource = fs.readFileSync(path.join(root, "lib/uiCopyExtra.ts"), "utf8");
const uiCopyExtraCompiled = ts.transpileModule(uiCopyExtraSource, {
  fileName: "uiCopyExtra.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const uiCopyExtraModule = { exports: {} };
new Function("module", "exports", uiCopyExtraCompiled)(uiCopyExtraModule, uiCopyExtraModule.exports);
const featureCopySource = fs.readFileSync(path.join(root, "lib/featureCopy.ts"), "utf8");
const featureCopyCompiled = ts.transpileModule(featureCopySource, {
  fileName: "featureCopy.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const featureCopyModule = { exports: {} };
new Function("module", "exports", featureCopyCompiled)(featureCopyModule, featureCopyModule.exports);
const trainerCopySource = fs.readFileSync(path.join(root, "lib/trainerCopy.ts"), "utf8");
const trainerCopyCompiled = ts.transpileModule(trainerCopySource, {
  fileName: "trainerCopy.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const trainerCopyModule = { exports: {} };
new Function("module", "exports", trainerCopyCompiled)(trainerCopyModule, trainerCopyModule.exports);
const surfaceCopySource = fs.readFileSync(path.join(root, "lib/surfaceCopy.ts"), "utf8");
const surfaceCopyCompiled = ts.transpileModule(surfaceCopySource, {
  fileName: "surfaceCopy.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const surfaceCopyModule = { exports: {} };
new Function("module", "exports", surfaceCopyCompiled)(surfaceCopyModule, surfaceCopyModule.exports);
const trainerUiCopySource = fs.readFileSync(path.join(root, "lib/trainerUiCopy.ts"), "utf8");
const trainerUiCopyCompiled = ts.transpileModule(trainerUiCopySource, {
  fileName: "trainerUiCopy.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const trainerUiCopyModule = { exports: {} };
new Function("module", "exports", trainerUiCopyCompiled)(trainerUiCopyModule, trainerUiCopyModule.exports);
const rightHandCopySource = fs.readFileSync(path.join(root, "lib/rightHandCopy.ts"), "utf8");
const rightHandCopyCompiled = ts.transpileModule(rightHandCopySource, {
  fileName: "rightHandCopy.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const rightHandCopyModule = { exports: {} };
new Function("module", "exports", rightHandCopyCompiled)(rightHandCopyModule, rightHandCopyModule.exports);
const require = (id) => id === "./pageCopy" ? pageCopyModule.exports : id === "./uiCopy" ? uiCopyModule.exports : id === "./uiCopyExtra" ? uiCopyExtraModule.exports : id === "./featureCopy" ? featureCopyModule.exports : id === "./trainerCopy" ? trainerCopyModule.exports : id === "./surfaceCopy" ? surfaceCopyModule.exports : id === "./trainerUiCopy" ? trainerUiCopyModule.exports : id === "./rightHandCopy" ? rightHandCopyModule.exports : baseRequire(id);
const source = fs.readFileSync(path.join(root, "lib/localization.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  fileName: "localization.tsx",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, require }, { filename: "localization.tsx" });
const { CATALOG, EXTRA_CATALOG, LANGUAGE_OPTIONS } = module.exports;
const { PAGE_COPY, HOME_CARD_COPY } = pageCopyModule.exports;
const { UI_COPY } = uiCopyModule.exports;
const { UI_COPY_EXTRA } = uiCopyExtraModule.exports;
const { FEATURE_COPY } = featureCopyModule.exports;
const { TRAINER_COPY } = trainerCopyModule.exports;
const { SURFACE_COPY } = surfaceCopyModule.exports;
const { TRAINER_UI_COPY } = trainerUiCopyModule.exports;
const { RIGHT_HAND_COPY } = rightHandCopyModule.exports;
const { detectLanguage, normalizeLanguage, isRightToLeft, translateCatalogText } = module.exports;
const ALL_CATALOG = Object.fromEntries(LANGUAGE_OPTIONS.map(([locale]) => [locale, { ...CATALOG[locale], ...EXTRA_CATALOG[locale], ...PAGE_COPY[locale], ...HOME_CARD_COPY[locale], ...UI_COPY[locale], ...UI_COPY_EXTRA[locale], ...FEATURE_COPY[locale], ...TRAINER_COPY[locale], ...SURFACE_COPY[locale], ...TRAINER_UI_COPY[locale], ...RIGHT_HAND_COPY[locale] }]));
const englishKeys = Object.keys(ALL_CATALOG.en).sort();
const englishTextKeys = {};
for (const catalog of [CATALOG, EXTRA_CATALOG, PAGE_COPY, HOME_CARD_COPY, UI_COPY, UI_COPY_EXTRA, FEATURE_COPY, TRAINER_COPY, SURFACE_COPY, TRAINER_UI_COPY, RIGHT_HAND_COPY]) {
  for (const [key, text] of Object.entries(catalog.en)) if (!(text in englishTextKeys)) englishTextKeys[text] = key;
}
const browserCatalog = (locale) => {
  // Match getMessage's precedence exactly, while retaining stable generated key order.
  const messages = { ...ALL_CATALOG[locale], ...CATALOG[locale], ...EXTRA_CATALOG[locale], ...HOME_CARD_COPY[locale], ...PAGE_COPY[locale], ...UI_COPY[locale], ...SURFACE_COPY[locale], ...TRAINER_COPY[locale], ...FEATURE_COPY[locale], ...UI_COPY_EXTRA[locale], ...TRAINER_UI_COPY[locale], ...RIGHT_HAND_COPY[locale] };
  return locale === "en" ? { messages, textKeys: englishTextKeys } : { messages };
};
const dumpLocale = process.argv.find((argument) => argument.startsWith("--dump-web-locale="))?.split("=")[1];
if (dumpLocale) {
  if (!LANGUAGE_OPTIONS.some(([locale]) => locale === dumpLocale)) throw new Error("Unknown browser catalog locale");
  console.log(JSON.stringify(browserCatalog(dumpLocale), null, 2));
  process.exit(0);
}
const xmlEscape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const androidName = (key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const nativeLocale = (locale) => locale === "zh-CN" ? "zh-Hans" : locale === "zh-TW" ? "zh-Hant" : locale;
for (const [locale] of LANGUAGE_OPTIONS) {
  const keys = Object.keys(ALL_CATALOG[locale] ?? {}).sort();
  if (keys.join("\n") !== englishKeys.join("\n")) throw new Error(`Catalog key mismatch for ${locale}`);
  for (const key of englishKeys) {
    const value = ALL_CATALOG[locale][key];
    if (typeof value !== "string" || value.trim().length === 0) throw new Error(`Missing message ${key} for ${locale}`);
    const parameters = (message) => [...message.matchAll(/\{([a-zA-Z][\w]*)\}/g)].map((match) => match[1]).sort().join("\n");
    if (parameters(value) !== parameters(ALL_CATALOG.en[key])) throw new Error(`Interpolation parameters mismatch for ${key} in ${locale}`);
  }
}

if (process.argv.includes("--validate")) {
  for (const [locale] of LANGUAGE_OPTIONS) {
    const file = path.join(root, "lib/locales", `${locale}.json`);
    if (JSON.stringify(JSON.parse(fs.readFileSync(file, "utf8"))) !== JSON.stringify(browserCatalog(locale))) throw new Error(`Browser catalog is stale for ${locale}; run localization:generate.`);
  }
  const cases = [
    [["fr-CA", "de-DE"], "fr"],
    [["xx-XX", "pt-BR"], "pt"],
    [["zh-HK"], "zh-TW"],
    [["zh-MO"], "zh-TW"],
    [["zh-SG"], "zh-CN"],
    [["zh-Hant"], "zh-TW"],
    [["de-CH"], "de"],
    [["xx-XX"], "en"]
  ];
  for (const [preferred, expected] of cases) {
    const actual = detectLanguage(preferred);
    if (actual !== expected) throw new Error(`Language detection ${JSON.stringify(preferred)} returned ${actual}; expected ${expected}`);
  }
  if (normalizeLanguage("zh_TW") !== "zh-TW") throw new Error("Underscore locale tags must normalize.");
  if (!isRightToLeft("ar") || !isRightToLeft("he") || !isRightToLeft("ur") || isRightToLeft("en")) throw new Error("RTL direction mapping is invalid.");
  for (const [locale, sourceText, expected] of [["de", "Daily Plan", "Tagesplan"], ["ar", "Accessibility", "إمكانية الوصول"], ["zh-CN", "Settings", "设置"]]) {
    if (translateCatalogText(locale, sourceText) !== expected) throw new Error(`Catalog text resolver failed for ${locale}: ${sourceText}`);
  }
  if (translateCatalogText("de", "User-authored text") !== "User-authored text") throw new Error("Unknown interface text must remain unchanged.");
  const clientSource = fs.readFileSync(path.join(root, "lib/localeClient.tsx"), "utf8");
  const clientCompiled = ts.transpileModule(clientSource, {
    fileName: "localeClient.tsx",
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText;
  const clientModule = { exports: {} };
  const clientRequire = (id) => id.startsWith("./locales/") ? JSON.parse(fs.readFileSync(path.join(root, "lib", `${id.slice(2)}`), "utf8")) : baseRequire(id);
  vm.runInNewContext(`${clientCompiled}\nmodule.exports.loadCatalogForValidation = loadCatalog;`, { module: clientModule, exports: clientModule.exports, require: clientRequire }, { filename: "localeClient.tsx" });
  await clientModule.exports.loadCatalogForValidation("de");
  const paddedPhrase = "  Daily Plan \n";
  if (clientModule.exports.translateCatalogText("de", paddedPhrase) !== translateCatalogText("de", paddedPhrase)) throw new Error("Lazy browser translation must preserve surrounding whitespace exactly like the full catalog API.");
  const { formatPlural } = module.exports;
  if (formatPlural("en", 1, { one: "{count} round", other: "{count} rounds" }) !== "1 round") throw new Error("Singular plural selection or interpolation failed.");
  if (formatPlural("ru", 3, { one: "{count} раунд", few: "{count} раунда", many: "{count} раундов", other: "{count} раунда" }) !== "3 раунда") throw new Error("Locale plural selection failed.");
  const stringCatalog = JSON.parse(fs.readFileSync(path.join(root, "ios/ChordHero/Resources/Localizable.xcstrings"), "utf8"));
  const androidRoot = path.join(root, "android/app/src/main/res");
  const localeConfig = fs.readFileSync(path.join(androidRoot, "xml/locales_config.xml"), "utf8");
  for (const [locale] of LANGUAGE_OPTIONS) {
    const qualifier = locale === "en" ? "values" : locale === "zh-CN" ? "values-zh-rCN" : locale === "zh-TW" ? "values-zh-rTW" : `values-${locale}`;
    const androidFile = path.join(androidRoot, qualifier, "strings.xml");
    const androidStrings = fs.readFileSync(androidFile, "utf8");
    for (const key of englishKeys) {
      const name = androidName(key);
      if (!androidStrings.includes(`<string name="${name}">${xmlEscape(ALL_CATALOG[locale][key])}</string>`)) {
        throw new Error(`Android resource is stale or missing ${key} for ${locale}`);
      }
      const nativeKey = ALL_CATALOG.en[key];
      const entry = stringCatalog.strings[nativeKey];
      if (!entry) throw new Error(`iOS string catalog is missing ${key}`);
      if (locale !== "en" && entry.localizations?.[nativeLocale(locale)]?.stringUnit?.value !== ALL_CATALOG[locale][key]) {
        throw new Error(`iOS string catalog is stale or missing ${key} for ${locale}`);
      }
    }
    if (!localeConfig.includes(`android:name="${locale}"`)) throw new Error(`Android locale config is missing ${locale}`);
  }
  console.log(`Validated ${LANGUAGE_OPTIONS.length} locales, ${englishKeys.length} catalog messages, and generated iOS/Android resources.`);
  process.exit(0);
}

const androidValues = (locale) => {
  const messages = ALL_CATALOG[locale];
  const rows = [
    `    <string name="app_name">Chord Hero</string>`,
    `    <string name="song_coach">Song Coach</string>`,
    ...englishKeys.map((key) => `    <string name="${androidName(key)}">${xmlEscape(messages[key])}</string>`)
  ].join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${rows}\n</resources>\n`;
};

const nativeStrings = {};
for (const key of englishKeys) {
  const localizations = {};
  for (const [locale] of LANGUAGE_OPTIONS) {
    if (locale === "en") continue;
    const nativeLocale = locale === "zh-CN" ? "zh-Hans" : locale === "zh-TW" ? "zh-Hant" : locale;
    localizations[nativeLocale] = { stringUnit: { state: "translated", value: ALL_CATALOG[locale][key] } };
  }
  nativeStrings[ALL_CATALOG.en[key]] = { comment: "Generated from the shared Chord Hero localization catalog.", localizations };
}
for (const [englishKey, messageKey] of [["Chart", "chordChart"], ["Tools", "settings"]]) {
  const localizations = {};
  for (const [locale] of LANGUAGE_OPTIONS) {
    if (locale === "en") continue;
    const nativeLocale = locale === "zh-CN" ? "zh-Hans" : locale === "zh-TW" ? "zh-Hant" : locale;
    localizations[nativeLocale] = { stringUnit: { state: "translated", value: CATALOG[locale][messageKey] } };
  }
  nativeStrings[englishKey] = { comment: "Compatibility label generated from the shared Chord Hero localization catalog.", localizations };
}
const xcstrings = { sourceLanguage: "en", strings: nativeStrings, version: "1.0" };

const androidRoot = path.join(root, "android/app/src/main/res");
fs.mkdirSync(path.join(root, "lib/locales"), { recursive: true });
for (const [locale] of LANGUAGE_OPTIONS) fs.writeFileSync(path.join(root, "lib/locales", `${locale}.json`), `${JSON.stringify(browserCatalog(locale), null, 2)}\n`);
for (const [locale] of LANGUAGE_OPTIONS) {
  if (locale === "en") continue;
  const qualifier = locale === "zh-CN" ? "values-zh-rCN" : locale === "zh-TW" ? "values-zh-rTW" : `values-${locale}`;
  const directory = path.join(androidRoot, qualifier);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "strings.xml"), androidValues(locale));
}
fs.writeFileSync(path.join(androidRoot, "values/strings.xml"), androidValues("en"));
fs.writeFileSync(path.join(root, "ios/ChordHero/Resources/Localizable.xcstrings"), `${JSON.stringify(xcstrings, null, 2)}\n`);
console.log(`Generated Android and iOS string resources for ${LANGUAGE_OPTIONS.length} locales.`);
