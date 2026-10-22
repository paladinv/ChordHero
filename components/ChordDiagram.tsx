"use client";

import type { KeyboardEvent } from "react";

export type Barre = {
  fret: number;
  from: number; // string index 0..5 (low E to high E)
  to: number;
};

export type Chord = {
  name: string;
  frets: number[]; // length 6, -1 mute, 0 open, >0 fret
  barre?: Barre;
  fingers?: Array<1 | 2 | 3 | 4 | null>;
};

export type ChordContact = { string: number; fret: number };
export type ChordDiagramEditor = {
  /** First fret in the bounded four-fret editing window. */
  baseFret: number;
  onFretSelect: (string: number, fret: number) => void;
  onOpenSelect: (string: number) => void;
  onMuteSelect: (string: number) => void;
};

export const normalizeChord = (chord: Chord): Chord => ({
  ...chord,
  frets: Array.from({ length: STRING_COUNT }, (_, index) => {
    const fret = chord.frets[index];
    return typeof fret === "number" && Number.isFinite(fret) ? Math.max(-1, fret) : -1;
  }),
  fingers: Array.from({ length: STRING_COUNT }, (_, index) => chord.fingers?.[index] ?? null)
});

type ChordDiagramProps = {
  chord: Chord;
  orientation?: "right" | "left";
  highContrast?: boolean;
  largeChart?: boolean;
  simplifiedChart?: boolean;
  /** Contact currently shared with the interactive trainer, if any. */
  selectedContact?: ChordContact | null;
  /** Called for open and fretted contacts. Muted strings intentionally do not emit a target. */
  onContactSelect?: (target: ChordContact) => void;
  /** Optional fretboard contacts to mark as scale context on the diagram. */
  scaleContacts?: readonly ChordContact[];
  /** Optional theory labels for played contacts. Kept off unless a caller explicitly requests them. */
  contactLabels?: readonly (ChordContact & { label: string; emphasis?: "root" | "third" | "fifth" | "seventh" | "color" })[];
  /** Opt-in editor controls. Ordinary chart diagrams remain static when omitted. */
  interactiveEditor?: ChordDiagramEditor;
};

const STRING_COUNT = 6;
const FRET_COUNT = 5; // includes nut/base line

function getBaseFret(chord: Chord) {
  const positive = chord.frets.filter((fret) => fret > 0);
  const maxFret = positive.length ? Math.max(...positive) : 1;
  const minFret = positive.length ? Math.min(...positive) : 1;
  if (maxFret <= 4) {
    return 1;
  }
  return chord.barre?.fret ?? minFret;
}

export default function ChordDiagram({ chord, orientation = "right", highContrast = false, largeChart = false, simplifiedChart = false, selectedContact = null, onContactSelect, scaleContacts = [], contactLabels = [], interactiveEditor }: ChordDiagramProps) {
  const chart = normalizeChord(chord);
  const width = 200;
  const height = 230;
  const paddingX = 22;
  const paddingY = 32;
  const gridWidth = width - paddingX * 2;
  const gridHeight = height - paddingY * 2;
  const stringGap = gridWidth / (STRING_COUNT - 1);
  const fretGap = gridHeight / (FRET_COUNT - 1);
  const editorBaseFret = interactiveEditor ? Math.max(1, Math.min(21, Math.round(interactiveEditor.baseFret))) : null;
  const baseFret = editorBaseFret ?? getBaseFret(chart);
  const selectContact = (string: number, fret: number) => {
    if (onContactSelect && fret >= 0) onContactSelect({ string, fret });
  };
  const isSelected = (string: number, fret: number) => selectedContact?.string === string && selectedContact.fret === fret;
  const scaleMarker = scaleContacts.length > 0;
  const contactKeyDown = (event: KeyboardEvent<SVGGElement>, string: number, fret: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectContact(string, fret);
    }
  };
  const editorKeyDown = (event: KeyboardEvent<SVGGElement>, action: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`diagram ${orientation === "left" ? "diagram-left-handed" : ""} ${highContrast ? "diagram-high-contrast" : ""} ${largeChart ? "diagram-large" : ""} ${simplifiedChart ? "diagram-simplified" : ""}`}
      role={interactiveEditor || onContactSelect ? "group" : "img"}
      aria-label={interactiveEditor ? `Interactive chord shape editor for ${chart.name}. Use the focusable fret cells, open controls, and mute controls to choose each string position.` : `Chord diagram for ${chart.name}. ${orientation === "left" ? "Left-handed mirrored chart. " : ""}X means muted, O means open, and numbers show fingerings.`}
    >
      <title>{`Chord diagram for ${chart.name}`}</title>
      <desc>{interactiveEditor ? "Keyboard-accessible four-fret editing window. Each cell exposes a string and fret and reports its pressed state." : `Six-string ${orientation === "left" ? "left-handed mirrored " : ""}guitar chart. X means muted, O means open, and numbers show recommended fingers.`}</desc>
      <rect x="0" y="0" width={width} height={height} rx="18" className="diagram-bg" />

      {Array.from({ length: STRING_COUNT }).map((_, index) => {
          const visualIndex = orientation === "left" ? STRING_COUNT - index - 1 : index;
          const x = paddingX + visualIndex * stringGap;
        return (
          <line
            key={`string-${index}`}
            x1={x}
            y1={paddingY}
            x2={x}
            y2={height - paddingY}
            className="diagram-string"
          />
        );
      })}

      {Array.from({ length: FRET_COUNT }).map((_, index) => {
        if (simplifiedChart && index > 0) return null;
        const y = paddingY + index * fretGap;
        return (
          <line
            key={`fret-${index}`}
            x1={paddingX}
            y1={y}
            x2={width - paddingX}
            y2={y}
            className={index === 0 && baseFret === 1 ? "diagram-nut" : "diagram-fret"}
          />
        );
      })}

      {baseFret > 1 && (
        <text x={width - paddingX + 8} y={paddingY + fretGap * 0.6} className="diagram-base">
          {baseFret}fr
        </text>
      )}

      {chart.barre && (
        <rect
          x={paddingX + (orientation === "left" ? STRING_COUNT - 1 - chart.barre.to : chart.barre.from) * stringGap - 8}
          y={paddingY + (chart.barre.fret - baseFret + 1) * fretGap - fretGap / 2 - 8}
          width={(chart.barre.to - chart.barre.from) * stringGap + 16}
          height={16}
          rx={8}
          className="diagram-barre"
        />
      )}

      {interactiveEditor ? Array.from({ length: STRING_COUNT }).flatMap((_, stringIndex) => Array.from({ length: FRET_COUNT - 1 }).map((__, offset) => {
        const fret = baseFret + offset;
        const visualIndex = orientation === "left" ? STRING_COUNT - stringIndex - 1 : stringIndex;
        const x = paddingX + visualIndex * stringGap;
        const y = paddingY + (offset + 1) * fretGap - fretGap / 2;
        const selected = chart.frets[stringIndex] === fret;
        return <g key={`editor-fret-${stringIndex}-${fret}`} role="button" tabIndex={0} aria-label={`String ${stringIndex + 1}, fret ${fret}`} aria-pressed={selected} onClick={() => interactiveEditor.onFretSelect(stringIndex, fret)} onKeyDown={(event) => editorKeyDown(event, () => interactiveEditor.onFretSelect(stringIndex, fret))}>
          <rect x={x - stringGap * 0.28} y={y - fretGap * 0.42} width={stringGap * 0.56} height={fretGap * 0.84} rx={5} className={selected ? "diagram-editor-cell diagram-editor-cell-selected" : "diagram-editor-cell"} />
        </g>;
      })) : null}

      {interactiveEditor ? Array.from({ length: STRING_COUNT }).map((_, stringIndex) => {
        const visualIndex = orientation === "left" ? STRING_COUNT - stringIndex - 1 : stringIndex;
        const x = paddingX + visualIndex * stringGap;
        const open = chart.frets[stringIndex] === 0;
        const muted = chart.frets[stringIndex] < 0;
        return <g key={`editor-open-mute-${stringIndex}`}>
          <g role="button" tabIndex={0} aria-label={`String ${stringIndex + 1}, open`} aria-pressed={open} onClick={() => interactiveEditor.onOpenSelect(stringIndex)} onKeyDown={(event) => editorKeyDown(event, () => interactiveEditor.onOpenSelect(stringIndex))}>
            <text x={x} y={paddingY - 12} className={open ? "diagram-open diagram-editor-control-selected" : "diagram-open"}>O</text>
          </g>
          <g role="button" tabIndex={0} aria-label={`String ${stringIndex + 1}, muted`} aria-pressed={muted} onClick={() => interactiveEditor.onMuteSelect(stringIndex)} onKeyDown={(event) => editorKeyDown(event, () => interactiveEditor.onMuteSelect(stringIndex))}>
            <text x={x} y={paddingY - 24} className={muted ? "diagram-mute diagram-editor-control-selected" : "diagram-mute"}>X</text>
          </g>
        </g>;
      }) : null}

      {chart.frets.map((fret, stringIndex) => {
        const visualIndex = orientation === "left" ? STRING_COUNT - stringIndex - 1 : stringIndex;
        const x = paddingX + visualIndex * stringGap;
        if (fret === 0) {
          if (interactiveEditor) return null;
          const theoryLabel = contactLabels.find((contact) => contact.string === stringIndex && contact.fret === 0);
          return (
            <g
              key={`open-${stringIndex}`}
              className={isSelected(stringIndex, 0) ? "diagram-contact-selected" : undefined}
              role={onContactSelect ? "button" : undefined}
              tabIndex={onContactSelect ? 0 : undefined}
              aria-label={`String ${stringIndex + 1}, open`}
              style={isSelected(stringIndex, 0) ? { filter: "drop-shadow(0 0 3px #f4b350)" } : undefined}
              onClick={() => selectContact(stringIndex, 0)}
              onKeyDown={(event) => contactKeyDown(event, stringIndex, 0)}
            >
              <text x={x} y={paddingY - 12} className={`diagram-open${theoryLabel ? ` diagram-open-tone-${theoryLabel.emphasis ?? "color"}` : ""}`}>{theoryLabel?.label ?? "O"}</text>
            </g>
          );
        }
        if (fret < 0) {
          if (interactiveEditor) return null;
          return (
            <text key={`mute-${stringIndex}`} x={x} y={paddingY - 12} className={isSelected(stringIndex, fret) ? "diagram-mute diagram-contact-selected" : "diagram-mute"} aria-label={`String ${stringIndex + 1}, muted`} style={isSelected(stringIndex, fret) ? { fill: "#f4b350" } : undefined}>
              X
            </text>
          );
        }

        if (interactiveEditor && (fret < baseFret || fret > baseFret + FRET_COUNT - 2)) return null;
        const position = fret - baseFret + 1;
        const y = paddingY + position * fretGap - fretGap / 2;
        const finger = chart.fingers?.[stringIndex] ?? null;
        const theoryLabel = contactLabels.find((contact) => contact.string === stringIndex && contact.fret === fret);

        return (
          <g
            key={`dot-${stringIndex}`}
            className={isSelected(stringIndex, fret) ? "diagram-contact-selected" : undefined}
            pointerEvents={interactiveEditor ? "none" : undefined}
            role={onContactSelect ? "button" : undefined}
            tabIndex={onContactSelect ? 0 : undefined}
            aria-label={`String ${stringIndex + 1}, fret ${fret}${finger ? `, finger ${finger}` : ""}`}
            style={isSelected(stringIndex, fret) ? { filter: "drop-shadow(0 0 4px #f4b350)" } : undefined}
            onClick={() => selectContact(stringIndex, fret)}
            onKeyDown={(event) => contactKeyDown(event, stringIndex, fret)}
          >
            <circle cx={x} cy={y} r={11} className={`diagram-dot${theoryLabel ? ` diagram-tone-${theoryLabel.emphasis ?? "color"}` : ""}`} stroke={isSelected(stringIndex, fret) ? "#f4b350" : undefined} strokeWidth={isSelected(stringIndex, fret) ? 3 : undefined} />
            {(theoryLabel || finger) && !simplifiedChart ? (
              <text x={x} y={y + 4} className="diagram-finger">
                {theoryLabel?.label ?? finger}
              </text>
            ) : null}
          </g>
        );
      })}
      {scaleMarker ? scaleContacts.map((contact) => {
        const visualIndex = orientation === "left" ? STRING_COUNT - contact.string - 1 : contact.string;
        const x = paddingX + visualIndex * stringGap;
        const position = contact.fret - baseFret + 1;
        const y = contact.fret === 0 ? paddingY - 12 : paddingY + position * fretGap - fretGap / 2;
        return <circle key={`scale-${contact.string}-${contact.fret}`} cx={x} cy={y} r={contact.fret === 0 ? 5 : 14} className="diagram-scale-marker" aria-label={`Scale tone on string ${contact.string + 1}, fret ${contact.fret}`} />;
      }) : null}
      {scaleMarker ? <text x={paddingX} y={height - 8} className="diagram-scale-label">Scale tones highlighted</text> : null}
      {contactLabels.length ? <text x={paddingX} y={height - 8} className="diagram-scale-label">R root · 3 third · 5 fifth · 7 seventh</text> : null}
    </svg>
  );
}
