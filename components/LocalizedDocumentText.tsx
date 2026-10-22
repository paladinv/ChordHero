"use client";

import { useEffect } from "react";
import { translateCatalogText, useLocale } from "../lib/localeClient";

type TextState = { source: string; rendered: string };
type AttributeState = { source: string; rendered: string };

const textStates = new WeakMap<Text, TextState>();
const attributeStates = new WeakMap<Element, Map<string, AttributeState>>();
const textNodeFilter = typeof NodeFilter === "undefined" ? 4 : NodeFilter.SHOW_TEXT;

function shouldSkip(node: Node) {
  const parent = node.parentElement;
  return !parent || Boolean(parent.closest("svg, canvas, script, style, noscript, textarea, input, code, pre, [contenteditable='true'], [data-user-content], [data-localization-ignore]"));
}

/** Applies exact shared-catalog matches to reusable panels without changing their stored data. */
export default function LocalizedDocumentText() {
  const { language } = useLocale();

  useEffect(() => {
    const root = document.body;
    let frame = 0;
    const process = () => {
      const walker = document.createTreeWalker(root, textNodeFilter);
      let current: Node | null;
      while ((current = walker.nextNode())) {
        if (current.nodeType !== Node.TEXT_NODE || shouldSkip(current)) continue;
        const node = current as Text;
        const existing = textStates.get(node);
        const currentText = node.data;
        const source = existing?.rendered === currentText ? existing.source : currentText;
        const rendered = translateCatalogText(language, source);
        if (rendered !== currentText) node.data = rendered;
        textStates.set(node, { source, rendered });
      }

      const attributes = ["aria-label", "aria-description", "title", "placeholder"];
      root.querySelectorAll("[aria-label], [aria-description], [title], [placeholder]").forEach((element) => {
        const states = attributeStates.get(element) ?? new Map<string, AttributeState>();
        for (const attribute of attributes) {
          const currentValue = element.getAttribute(attribute);
          if (currentValue === null) continue;
          const existing = states.get(attribute);
          const source = existing?.rendered === currentValue ? existing.source : currentValue;
          const rendered = translateCatalogText(language, source);
          if (rendered !== currentValue) element.setAttribute(attribute, rendered);
          states.set(attribute, { source, rendered });
        }
        attributeStates.set(element, states);
      });
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        process();
      });
    };

    process();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "aria-description", "title", "placeholder"] });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [language]);

  return null;
}
