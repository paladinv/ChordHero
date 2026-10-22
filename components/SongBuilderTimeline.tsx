"use client";
import { useMemo, useRef, useState } from "react";
import type { SongComposition, SongCompositionEvent } from "@/lib/songLibrary";
import { eventMidiPitches } from "@/lib/songBuilder";
import { assignPitches, measureBeats, writeAcrossBars } from "@/lib/songBuilderStudio";
import { editMeasure } from "@/lib/songBuilderEditing";
type Props = {
  hasSelection: boolean;
  onEdit: () => void;
  composition: SongComposition;
  onChange: (value: SongComposition) => void;
  onSelect: (sectionId: string, trackId: string, index: number, eventId?: string) => void;
  onMessage: (message: string) => void;
  position: {
    sectionId: string;
    measureIndex: number;
    fraction: number;
  } | null;
};
export default function SongBuilderTimeline({ hasSelection, onEdit, composition, onChange, onSelect, onMessage, position }: Props) {
  const [zoom, setZoom] = useState(160);
  const bars = useMemo(() => composition.sections.flatMap(section => Array.from({ length: Math.max(1, ...Object.values(section.measuresByTrack).map(part => part.length)) }, (_, index) => ({ section, index, beats: measureBeats(composition, section.id, index) }))), [composition]);
  const drag = useRef<{
    x: number;
    y: number;
    sectionId: string;
    trackId: string;
    index: number;
    event: SongCompositionEvent;
    resize: boolean;
  } | null>(null);
  const commit = (clientX: number, clientY: number) => {
    const start = drag.current;
    drag.current = null;
    if (!start)
      return;
    const source = bars.find(bar => bar.section.id === start.sectionId && bar.index === start.index)!;
    const delta = Math.round((clientX - start.x) / zoom * source.beats * 4) / 4;
    if (Math.abs(clientX - start.x) < 4 && Math.abs(clientY - start.y) < 4)
      return;
    try {
      if (start.resize) {
        onChange(writeAcrossBars(composition, start.sectionId, start.trackId, start.index, { ...start.event, durationBeats: Math.max(.25, start.event.durationBeats + delta) }, start.event.id));
        return;
      }
      const cell = document.elementsFromPoint(clientX, clientY).map(node => node.closest<HTMLElement>("[data-timeline-bar]")).find(Boolean);
      const target = cell ? bars[Number(cell.dataset.timelineBar)] : source;
      const targetTrack = composition.tracks.find(track => track.id === cell?.dataset.trackId) ?? composition.tracks.find(track => track.id === start.trackId)!;
      let beat = target === source ? start.event.startBeat + delta : Math.round(Math.max(0, Math.min(target.beats - .25, (clientX - cell!.getBoundingClientRect().left) / zoom * target.beats)) * 4) / 4;
      let index = target.index;
      let sectionId = target.section.id;
      if (beat < 0) {
        const global = bars.findIndex(bar => bar === target) - 1;
        if (global < 0)
          beat = 0;
        else {
          sectionId = bars[global].section.id;
          index = bars[global].index;
          beat = Math.max(0, bars[global].beats + beat);
        }
      }
      const sourceTrack = composition.tracks.find(track => track.id === start.trackId)!;
      const moved = targetTrack.id === sourceTrack.id ? start.event : assignPitches(targetTrack, start.event, eventMidiPitches(sourceTrack, start.event));
      const removed = editMeasure(composition, start.sectionId, start.trackId, start.index, measure => ({ ...measure, events: measure.events.filter(event => event.id !== start.event.id) }));
      onChange(writeAcrossBars(removed, sectionId, targetTrack.id, index, { ...moved, startBeat: beat }));
      onSelect(sectionId, targetTrack.id, index, start.event.id);
    }
    catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not move this event.");
    }
  };
  return <section className="card song-builder-card builder-timeline" aria-label="Full song timeline">
    <div className="song-builder-card-head">
      <h2>Song timeline</h2>
      <button className="btn" type="button" disabled={!hasSelection} onClick={onEdit}>Edit selected event</button>
      <label>Timeline zoom<input type="range" min={100} max={320} step={20} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
      </label>
    </div>
    <p>Drag notes between bars or tracks. Drag the right handle to resize; long notes split into tied fragments. Focus a note and use arrow keys to move it, or Shift+arrows to resize.</p>
    <div className="builder-timeline-scroll">
      <div style={{ width: 140 + bars.length * zoom }}>
        <div className="builder-timeline-row">
          <strong>Arrangement</strong>{bars.map((bar, i) => <button key={`${bar.section.id}-${bar.index}`} style={{ width: zoom }} type="button" onClick={() => onSelect(bar.section.id, composition.tracks[0].id, bar.index)}>{i + 1} · {bar.section.title}{bar.section.repeats > 1 ? ` ×${bar.section.repeats}` : ""}</button>)}</div>{composition.tracks.map(track => <div className="builder-timeline-row" key={track.id}>
            <strong>{track.name}</strong>{bars.map((bar, i) => <div className="builder-timeline-cell" key={`${bar.section.id}-${bar.index}`} data-timeline-bar={i} data-track-id={track.id} style={{ width: zoom }}>{bar.section.measuresByTrack[track.id]?.[bar.index]?.events.map((event, j) => <div key={event.id} className="builder-timeline-event" style={{ left: `${event.startBeat / bar.beats * 100}%`, width: `${Math.min(event.durationBeats, bar.beats - event.startBeat) / bar.beats * 100}%`, top: 8 + j % 3 * 25 }}>
              <button type="button" aria-label={`${track.name}, ${bar.section.title} bar ${bar.index + 1}, ${event.kind} ${event.chord ?? event.fret ?? ""}, beat ${event.startBeat + 1}, length ${event.durationBeats}`} onClick={() => onSelect(bar.section.id, track.id, bar.index, event.id)} onPointerDown={e => {
                if (e.button !== 0)
                  return; drag.current = { x: e.clientX, y: e.clientY, sectionId: bar.section.id, trackId: track.id, index: bar.index, event, resize: false }; e.currentTarget.setPointerCapture(e.pointerId);
              }} onPointerUp={e => commit(e.clientX, e.clientY)} onPointerCancel={() => { drag.current = null; }} onKeyDown={e => {
                if (!["ArrowLeft", "ArrowRight"].includes(e.key))
                  return; e.preventDefault(); const delta = e.key === "ArrowRight" ? .25 : -.25; try {
                    onChange(writeAcrossBars(composition, bar.section.id, track.id, bar.index, { ...event, startBeat: e.shiftKey ? event.startBeat : Math.max(0, event.startBeat + delta), durationBeats: e.shiftKey ? Math.max(.25, event.durationBeats + delta) : event.durationBeats }, event.id));
                  }
                catch (error) {
                  onMessage(String(error));
                }
              }}>{event.kind === "rest" ? "Rest" : event.chord ?? `${event.string ?? "M"}:${event.fret ?? event.midiPitches?.join(",")}`}</button>
              <button type="button" className="builder-resize" aria-label={`Resize event ${event.id}`} onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY, sectionId: bar.section.id, trackId: track.id, index: bar.index, event, resize: true }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => commit(e.clientX, e.clientY)}>↔</button>
            </div>)}{position?.sectionId === bar.section.id && position.measureIndex === bar.index ? <i className="builder-timeline-playhead" style={{ left: `${position.fraction * 100}%` }} /> : null}</div>)}</div>)}</div>
    </div>
  </section>;
}
