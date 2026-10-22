"use client";

import { useEffect, useId, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { beatsPerBar, type ExpandedOccurrence } from "../../lib/chordChartArrangement";

/** The optional section-level material shown alongside the arrangement. */
export type ArrangementCue = {
  lyrics: string;
  cue: string;
  parts: Record<string, string>;
};

export type ArrangementPreviewProps = {
  sequence: ExpandedOccurrence[];
  cues?: Record<string, ArrangementCue>;
  /** Enables the page-broken print artifact. The regular screen view is used otherwise. */
  printable?: boolean;
};

type ArrangementSegment = {
  occurrence: ExpandedOccurrence;
  barIndex: number;
  offset: number;
  duration: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

type ArrangementBar = {
  key: string;
  sectionId: string;
  sectionTitle: string;
  repeat: number;
  meter: string;
  bpm: number;
  beats: number;
  number: number;
  segments: ArrangementSegment[];
};

type ArrangementPage = { key: string; bars: ArrangementBar[] };

const MAX_PREVIEW_EVENTS = 512;

const endingIdsFor = (occurrence: ExpandedOccurrence, ending: "first" | "second") => {
  const metadata = occurrence as ExpandedOccurrence & Record<string, unknown>;
  const candidates = ending === "first"
    ? [metadata.firstEndingIds, metadata.firstEnding, metadata.endingIds]
    : [metadata.secondEndingIds, metadata.secondEnding, metadata.endingIds];
  const nestedIds = metadata.endingIds && typeof metadata.endingIds === "object" && !Array.isArray(metadata.endingIds)
    ? (metadata.endingIds as Record<string, unknown>)[ending]
    : undefined;
  return [...candidates, nestedIds].flatMap((value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
};

const endingLabelFor = (occurrence: ExpandedOccurrence) => {
  if (occurrence.ending === "first") return "1st ending";
  if (occurrence.ending === "second") return "2nd ending";
  const id = occurrence.id;
  if (id && endingIdsFor(occurrence, "first").includes(id)) return "1st ending";
  if (id && endingIdsFor(occurrence, "second").includes(id)) return "2nd ending";
  return "";
};

const groupedBars = (sequence: ExpandedOccurrence[]): ArrangementBar[] => {
  const groups = new Map<string, ExpandedOccurrence[]>();
  sequence.slice(0, MAX_PREVIEW_EVENTS).forEach((occurrence) => {
    const key = `${occurrence.sectionId}::${occurrence.repeat}`;
    const group = groups.get(key);
    if (group) group.push(occurrence);
    else groups.set(key, [occurrence]);
  });

  const bars: ArrangementBar[] = [];
  groups.forEach((occurrences, groupKey) => {
    const first = occurrences[0];
    if (!first) return;
    const beatsInBar = Math.max(1, beatsPerBar(first.meter));
    const origin = Math.min(...occurrences.map((occurrence) => occurrence.startBeat));
    const byBar = new Map<number, ArrangementBar>();
    occurrences.forEach((occurrence) => {
      const start = Math.max(0, occurrence.startBeat - origin);
      const duration = Math.max(0.125, occurrence.endBeat - occurrence.startBeat || occurrence.beats);
      const end = start + duration;
      let position = start;
      while (position < end - 0.0001) {
        const barIndex = Math.floor(position / beatsInBar);
        const barStart = barIndex * beatsInBar;
        const offset = position - barStart;
        const segmentDuration = Math.min(end - position, beatsInBar - offset);
        const segment: ArrangementSegment = {
          occurrence,
          barIndex,
          offset,
          duration: segmentDuration,
          continuesBefore: position > start + 0.0001,
          continuesAfter: end > position + segmentDuration + 0.0001,
        };
        const existing = byBar.get(barIndex);
        if (existing) existing.segments.push(segment);
        else byBar.set(barIndex, {
          key: `${groupKey}::bar-${barIndex}`,
          sectionId: first.sectionId,
          sectionTitle: first.sectionTitle,
          repeat: first.repeat,
          meter: first.meter,
          bpm: first.bpm,
          beats: beatsInBar,
          number: barIndex + 1,
          segments: [segment],
        });
        position += segmentDuration;
      }
    });
    [...byBar.values()].sort((left, right) => left.number - right.number).forEach((bar) => bars.push(bar));
  });
  return bars;
};

const pageGroups = (bars: ArrangementBar[]): ArrangementPage[] => {
  const pages: ArrangementPage[] = [];
  for (let index = 0; index < bars.length; index += 8) {
    const pageBars = bars.slice(index, index + 8);
    pages.push({ key: `page-${index / 8 + 1}`, bars: pageBars });
  }
  return pages;
};

const sectionCue = (cues: Record<string, ArrangementCue> | undefined, sectionId: string, sectionTitle: string) => cues?.[sectionId] ?? cues?.[sectionTitle];

const Bar = ({ bar, cues }: { bar: ArrangementBar; cues?: Record<string, ArrangementCue> }) => {
  const cue = sectionCue(cues, bar.sectionId, bar.sectionTitle);
  return (
    <article className="chord-workflow-bar" style={{ "--beat-count": bar.beats } as CSSProperties} aria-label={`${bar.sectionTitle}, repeat ${bar.repeat}, bar ${bar.number}`}>
      <header className="chord-workflow-bar__header">
        <strong>Bar {bar.number}</strong>
        <span>{bar.sectionTitle} · repeat {bar.repeat}</span>
        <span>{bar.meter} · {bar.bpm} BPM</span>
      </header>
      <div className="chord-workflow-beats" aria-label={`${bar.beats} beats`}>
        {Array.from({ length: bar.beats }, (_, beat) => <span key={beat}>{beat + 1}</span>)}
      </div>
      <div className="chord-workflow-events">
        {bar.segments.map((segment, index) => {
          const ending = endingLabelFor(segment.occurrence);
          const label = segment.continuesBefore ? `↳ ${segment.occurrence.chord}` : segment.occurrence.chord;
          return (
            <div
              className={`chord-workflow-event${segment.occurrence.held || segment.continuesAfter ? " is-held" : ""}`}
              key={`${segment.occurrence.id ?? segment.occurrence.occurrenceIndex}-${index}`}
              style={{ "--event-start": Math.round(segment.offset * 8), "--event-span": Math.max(1, Math.round(segment.duration * 8)) } as CSSProperties}
              title={`${segment.occurrence.chord} · ${segment.duration} beat${segment.duration === 1 ? "" : "s"}`}
            >
              <span className="chord-workflow-event__chord">{label}</span>
              {segment.occurrence.held || segment.continuesAfter ? <span className="chord-workflow-event__held">held{segment.continuesAfter ? " →" : ""}</span> : null}
              {ending ? <span className="chord-workflow-event__ending">{ending}</span> : null}
            </div>
          );
        })}
      </div>
      {cue ? (
        <aside className="chord-workflow-cue" aria-label={`${bar.sectionTitle} cues`}>
          {cue.cue ? <p><strong>Cue</strong> {cue.cue}</p> : null}
          {cue.lyrics ? <p><strong>Lyrics</strong> {cue.lyrics}</p> : null}
          {Object.entries(cue.parts).filter(([, value]) => value.trim()).map(([part, value]) => <p key={part}><strong>{part}</strong> {value}</p>)}
        </aside>
      ) : null}
    </article>
  );
};

const PreviewPages = ({ pages, cues }: { pages: ArrangementPage[]; cues?: Record<string, ArrangementCue> }) => (
  <div className="chord-workflow-pages">
    {pages.map((page, index) => (
      <section className={`chord-workflow-page${index > 0 ? " has-print-break" : ""}`} key={page.key} aria-label={`Printed page ${index + 1}`}>
        <div className="chord-workflow-page__heading"><span>Arrangement preview</span><span>Page {index + 1}</span></div>
        <div className="chord-workflow-bars">{page.bars.map((bar) => <Bar key={bar.key} bar={bar} cues={cues} />)}</div>
      </section>
    ))}
  </div>
);

/** A bounded, repeat-aware chart preview that is suitable for screen or print. */
export function ArrangementPreview({ sequence, cues, printable = false }: ArrangementPreviewProps) {
  const pages = useMemo(() => pageGroups(groupedBars(sequence)), [sequence]);
  if (!sequence.length) return <section className="chord-arrangement-preview" aria-label="Arrangement preview"><p className="chord-workflow-empty">Add an arrangement to preview bars.</p></section>;
  return (
    <section className="chord-arrangement-preview" data-printable={printable ? "true" : "false"} aria-label="Arrangement preview">
      {printable ? <div className="chord-workflow-print-artifact" data-enabled="true"><PreviewPages pages={pages} cues={cues} /></div> : <div className="chord-arrangement-screen"><PreviewPages pages={pages} cues={cues} /></div>}
    </section>
  );
}

type DialogAction = { label: string; onClick: () => void; variant?: "primary" | "danger" | "ghost" };

type WorkflowDialogProps = {
  title: string;
  description: string;
  actions: DialogAction[];
  onCancel: () => void;
  children?: ReactNode;
};

const WorkflowDialog = ({ title, description, actions, onCancel, children }: WorkflowDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialFocusRef.current?.focus();
    const dialog = dialogRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.addEventListener("keydown", onKeyDown);
    return () => {
      dialog?.removeEventListener("keydown", onKeyDown);
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
    };
  }, [onCancel]);

  return (
    <div className="chord-workflow-dialog-backdrop">
      <div className="chord-workflow-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        {children}
        <div className="chord-workflow-dialog__actions">
          {actions.map((action, index) => <button key={action.label} ref={index === 0 ? initialFocusRef : undefined} className={`btn ${action.variant === "primary" ? "primary" : action.variant === "danger" ? "danger" : "ghost"}`} type="button" onClick={action.onClick}>{action.label}</button>)}
          <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export type ChartImportConflictDialogProps = {
  incomingName: string;
  existingName: string;
  onKeepBoth: () => void;
  onReplace: () => void;
  onSkip: () => void;
  onCancel: () => void;
};

export function ChartImportConflictDialog({ incomingName, existingName, onKeepBoth, onReplace, onSkip, onCancel }: ChartImportConflictDialogProps) {
  return <WorkflowDialog title="Chart already exists" description={`“${incomingName}” conflicts with the existing chart “${existingName}”. Choose how to continue.`} actions={[{ label: "Keep both", onClick: onKeepBoth, variant: "primary" }, { label: "Replace", onClick: onReplace, variant: "danger" }, { label: "Skip", onClick: onSkip, variant: "ghost" }]} onCancel={onCancel} />;
}

export type UnsavedChartDialogProps = {
  label?: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function UnsavedChartDialog({ label = "this chart", onSave, onDiscard, onCancel }: UnsavedChartDialogProps) {
  return <WorkflowDialog title="Unsaved changes" description={`Save your changes to ${label} before leaving?`} actions={[{ label: "Save", onClick: onSave, variant: "primary" }, { label: "Discard", onClick: onDiscard, variant: "danger" }]} onCancel={onCancel} />;
}
