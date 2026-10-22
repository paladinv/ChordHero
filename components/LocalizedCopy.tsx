"use client";

import { useLocale } from "../lib/localeClient";
import type { MessageKey } from "../lib/localeClient";

/** Resolves a shared, presentation-only interface label in the active locale. */
export default function LocalizedCopy({ id }: { id: MessageKey }) {
  const { t } = useLocale();
  return <>{t(id)}</>;
}
