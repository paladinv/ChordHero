import type { LibrarySong } from "./songLibrary";
import { buildSongTimeline, meterParts, type TimelineBar } from "./songBuilder";

export type NotationView = "tab" | "staff";
export const BUILDER_PAGE_BARS = 4;
export const BUILDER_SHEET_WIDTH = 1200;
export const BUILDER_SHEET_HEIGHT = 900;

const ink = "#1b1a17";
const muted = "#66655f";
const teal = "#1f7a74";
const coral = "#d4573b";

function pitchName(midi: number, key: string) {
  const flats = /^(F|Bb|Eb|Ab|Db|Gb|Cb|Dm|Gm|Cm|Fm|Bbm|Ebm)/.test(key);
  const names = flats ? ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] : ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function staffStep(midi: number) {
  const pitch = ((midi % 12) + 12) % 12;
  const pitchLetters = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  return (Math.floor(midi / 12) - 1) * 7 + pitchLetters[pitch];
}

function clearPage(context: CanvasRenderingContext2D) {
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, BUILDER_SHEET_WIDTH, BUILDER_SHEET_HEIGHT);
}

export function drawNotationPage(song: LibrarySong, bars: TimelineBar[], view: NotationView, pageIndex: number, cursor?: { barIndex: number; fraction: number } | null) {
  const canvas = document.createElement("canvas");
  canvas.width = BUILDER_SHEET_WIDTH;
  canvas.height = BUILDER_SHEET_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the notation preview.");
  clearPage(context);

  const pageBars = bars.slice(pageIndex * BUILDER_PAGE_BARS, (pageIndex + 1) * BUILDER_PAGE_BARS);
  const tracks = song.composition?.tracks ?? [];
  const perTrack = tracks.length ? Math.floor((640 - Math.max(0, tracks.length - 1) * 16) / tracks.length) : 120;
  const trackHeight = Math.max(view === "tab" ? 78 : 105, Math.min(view === "tab" ? 150 : 190, perTrack));
  const firstBar = pageBars[0];

  context.fillStyle = ink;
  context.font = "700 30px Georgia, serif";
  context.fillText(song.title || "Untitled song", 62, 60, 900);
  context.font = "16px Arial, sans-serif";
  context.fillStyle = muted;
  context.fillText(`${song.artist || "Original composition"} · Key ${song.composition?.key ?? song.key} · ${firstBar?.bpm ?? song.bpm} BPM · ${firstBar?.meter ?? song.composition?.timeSignature ?? song.timeSignature}`, 64, 88, 1050);
  context.textAlign = "right";
  context.fillStyle = teal;
  context.font = "700 14px Arial, sans-serif";
  context.fillText(view === "tab" ? "TABLATURE" : "STANDARD NOTATION", 1138, 60);
  context.textAlign = "left";
  context.strokeStyle = "#d8d1c5";
  context.lineWidth = 1;
  context.beginPath(); context.moveTo(62, 108); context.lineTo(1138, 108); context.stroke();

  const left = 128;
  const right = 1138;
  const barWidth = (right - left) / Math.max(1, pageBars.length);
  const startY = 142;
  tracks.forEach((track, trackIndex) => {
    const top = startY + trackIndex * (trackHeight + 16);
    const lineGap = view === "tab" ? Math.min(18, (trackHeight - 36) / Math.max(3, track.tuning.length - 1)) : 12;
    const stringCount = track.tuning.length;
    context.textAlign = "left";
    context.fillStyle = ink;
    context.font = "700 15px Arial, sans-serif";
    context.fillText(track.name, 62, top + 19);
    context.font = "12px Arial, sans-serif";
    context.fillStyle = muted;
    context.fillText(`${track.instrument} · ${track.tuningLabel}${track.capo ? ` · capo ${track.capo}` : ""}`, 62, top + 37, 450);

    if (view === "tab") {
      const tabTop = top + 52;
      context.strokeStyle = "#85847e";
      context.lineWidth = 1;
      for (let stringIndex = 0; stringIndex < stringCount; stringIndex += 1) {
        const y = tabTop + stringIndex * lineGap;
        context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke();
        context.fillStyle = muted;
        context.font = "10px Arial, sans-serif";
        context.textAlign = "right";
        context.fillText(String(stringIndex + 1), 119, y + 4);
      }
      context.textAlign = "left";
      pageBars.forEach((bar, localIndex) => {
        const x1 = left + localIndex * barWidth;
        const x2 = x1 + barWidth;
        context.strokeStyle = ink;
        context.lineWidth = 1.5;
        context.beginPath(); context.moveTo(x1, tabTop - 5); context.lineTo(x1, tabTop + (stringCount - 1) * lineGap + 7); context.stroke();
        context.font = "700 12px Arial, sans-serif";
        context.fillStyle = teal;
        context.fillText(`${bar.index + 1} · ${bar.sectionTitle}${bar.repeat > 1 ? ` ${bar.repeat}` : ""}`, x1 + 7, top + 15, barWidth - 14);
        context.font = "11px Arial, sans-serif";
        context.fillStyle = muted;
        context.fillText(bar.meter, x1 + 7, top + 32);
        for (const cue of bar.events.filter((item) => item.track.id === track.id)) {
          const x = x1 + 7 + (cue.event.startBeat / bar.measureBeats) * Math.max(1, barWidth - 15);
          if (cue.event.kind === "note" && cue.event.string) {
            const row = cue.event.string - 1;
            const y = tabTop + row * lineGap;
            context.fillStyle = coral;
            context.font = "700 13px Arial, sans-serif";
            context.textAlign = "center";
            context.fillText(String(cue.event.fret ?? 0), x, y + 4);
          } else if (cue.event.kind === "chord") {
            context.fillStyle = teal;
            context.font = "700 12px Arial, sans-serif";
            context.textAlign = "center";
            context.fillText(cue.event.chord ?? "Chord", x, tabTop - 7);
            if (cue.event.voicing) cue.event.voicing.forEach((fret, index) => {
              if (fret === null || index >= stringCount) return;
              const y = tabTop + (stringCount - index - 1) * lineGap;
              context.fillStyle = coral;
              context.fillText(String(fret), x, y + 4);
            });
          }
        }
        context.textAlign = "left";
        if (localIndex === pageBars.length - 1) { context.beginPath(); context.moveTo(x2, tabTop - 5); context.lineTo(x2, tabTop + (stringCount - 1) * lineGap + 7); context.stroke(); }
      });
    } else {
      const staffTop = top + 58;
      const staffBottom = staffTop + lineGap * 4;
      context.strokeStyle = "#77766f";
      context.lineWidth = 1;
      for (let line = 0; line < 5; line += 1) { const y = staffTop + line * lineGap; context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke(); }
      context.fillStyle = teal;
      context.font = "38px serif";
      context.fillText(track.instrument === "bass" ? "𝄢" : "𝄞", 65, staffTop + 42);
      if (track.instrument !== "bass") {
        context.font = "700 12px Arial, sans-serif";
        context.fillText("8", 81, staffTop + 65);
      }
      const baseMidi = track.instrument === "bass" ? 43 : 64;
      const baseStep = staffStep(baseMidi);
      pageBars.forEach((bar, localIndex) => {
        const x1 = left + localIndex * barWidth;
        const x2 = x1 + barWidth;
        context.strokeStyle = ink;
        context.lineWidth = 1.5;
        context.beginPath(); context.moveTo(x1, staffTop - 5); context.lineTo(x1, staffBottom + 7); context.stroke();
        context.fillStyle = teal;
        context.font = "700 11px Arial, sans-serif";
        context.fillText(`${bar.index + 1} · ${bar.sectionTitle}`, x1 + 7, top + 15, barWidth - 12);
        context.fillStyle = muted;
        context.font = "11px Arial, sans-serif";
        context.fillText(bar.meter, x1 + 7, top + 32);
        for (const cue of bar.events.filter((item) => item.track.id === track.id)) {
          const x = x1 + 15 + (cue.event.startBeat / bar.measureBeats) * Math.max(1, barWidth - 30);
          if (cue.event.kind === "chord") {
            context.fillStyle = teal;
            context.font = "700 12px Arial, sans-serif";
            context.textAlign = "center";
            context.fillText(cue.event.chord ?? "Chord", x, staffTop - 8);
          }
          const writtenPitches = cue.pitches.map((midi) => midi + (track.instrument === "bass" ? 0 : 12));
          writtenPitches.forEach((midi) => {
            const y = staffBottom - (staffStep(midi) - baseStep) * (lineGap / 2);
            const noteX = x;
            const openHead = cue.event.durationBeats >= 2;
            context.fillStyle = ink;
            context.beginPath(); context.ellipse(noteX, y, 6.5, 4.6, -0.25, 0, Math.PI * 2);
            if (openHead) { context.fillStyle = "#fffdf8"; context.fill(); context.strokeStyle = ink; context.lineWidth = 1.6; context.stroke(); }
            else context.fill();
            context.strokeStyle = ink;
            if (cue.event.durationBeats < 4) {
              context.lineWidth = 1.4;
              context.beginPath(); context.moveTo(noteX + 6, y); context.lineTo(noteX + 6, y - 22); context.stroke();
              const flags = cue.event.durationBeats <= 0.25 ? 2 : cue.event.durationBeats < 1 ? 1 : 0;
              for (let flag = 0; flag < flags; flag += 1) {
                context.beginPath(); context.moveTo(noteX + 6, y - 22 + flag * 7); context.quadraticCurveTo(noteX + 17, y - 19 + flag * 7, noteX + 12, y - 12 + flag * 7); context.stroke();
              }
              if (Math.abs(cue.event.durationBeats - 1 / 3) < 0.01) { context.font = "9px Arial, sans-serif"; context.fillStyle = muted; context.fillText("3", noteX + 10, y - 26); }
            }
            context.font = "9px Arial, sans-serif";
            context.fillStyle = muted;
            context.textAlign = "center";
            context.fillText(pitchName(midi, song.composition?.key ?? song.key), noteX, staffBottom + 21);
          });
        }
        context.textAlign = "left";
        if (localIndex === pageBars.length - 1) { context.beginPath(); context.moveTo(x2, staffTop - 5); context.lineTo(x2, staffBottom + 7); context.stroke(); }
      });
    }
  });

  const pageSectionIds = [...new Set(pageBars.map((bar) => bar.sectionId))];
  const sectionAnnotations = pageSectionIds.flatMap((sectionId) => {
    const section = song.composition?.sections.find((item) => item.id === sectionId);
    if (!section) return [];
    const lyrics = section.lyrics?.trim().replace(/\s*\n\s*/g, " / ");
    const notes = section.notes?.trim();
    return [
      ...(lyrics ? [`${section.title} lyrics · ${lyrics}`] : []),
      ...(notes ? [`${section.title} notes · ${notes}`] : []),
    ];
  }).slice(0, 2);
  context.textAlign = "left";
  context.fillStyle = muted;
  context.font = "11px Arial, sans-serif";
  sectionAnnotations.forEach((line, index) => context.fillText(line, 62, 808 + index * 16, 1076));

  if (cursor && cursor.barIndex >= pageIndex * BUILDER_PAGE_BARS && cursor.barIndex < (pageIndex + 1) * BUILDER_PAGE_BARS) {
    const localBar = cursor.barIndex - pageIndex * BUILDER_PAGE_BARS;
    const x = left + localBar * barWidth + Math.max(0, Math.min(1, cursor.fraction)) * barWidth;
    context.save();
    context.strokeStyle = coral;
    context.lineWidth = 3;
    context.setLineDash([7, 5]);
    context.beginPath(); context.moveTo(x, startY - 12); context.lineTo(x, Math.min(842, startY + tracks.length * (trackHeight + 16) - 8)); context.stroke();
    context.restore();
  }
  context.fillStyle = muted;
  context.font = "12px Arial, sans-serif";
  context.fillText(`${pageIndex + 1} / ${Math.max(1, Math.ceil(bars.length / BUILDER_PAGE_BARS))} · ${view === "tab" ? "String numbers and fret positions" : "Pitch names are included as reading support"}`, 62, 860);
  context.textAlign = "right";
  context.fillStyle = teal;
  context.font = "700 12px Arial, sans-serif";
  context.fillText("Chord Hero · Song Builder", 1138, 860);
  context.textAlign = "left";
  return canvas;
}

export function renderNotationPages(song: LibrarySong, view: NotationView, sectionId?: string, cursor?: { barIndex: number; fraction: number } | null) {
  const bars = buildSongTimeline(song, sectionId).bars;
  const count = Math.max(1, Math.ceil(bars.length / BUILDER_PAGE_BARS));
  return Array.from({ length: count }, (_, index) => drawNotationPage(song, bars, view, index, cursor));
}

export function canvasPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the PNG image.")), "image/png"));
}

export function canvasesPdf(canvases: HTMLCanvasElement[]) {
  if (!canvases.length) throw new Error("There is no notation to export yet.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  const append = (chunk: Uint8Array) => { chunks.push(chunk); length += chunk.length; };
  const text = (value: string) => append(new TextEncoder().encode(value));
  const offsets: number[] = [0];
  const objectCount = 2 + canvases.length * 3;
  text("%PDF-1.4\n");
  const object = (index: number, body: () => void) => { offsets[index] = length; text(`${index} 0 obj\n`); body(); text("\nendobj\n"); };
  object(1, () => text("<< /Type /Catalog /Pages 2 0 R >>"));
  const pageRefs = canvases.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  object(2, () => text(`<< /Type /Pages /Count ${canvases.length} /Kids [${pageRefs}] >>`));
  canvases.forEach((canvas, index) => {
    const pageObject = 3 + index * 3;
    const contentObject = pageObject + 1;
    const imageObject = pageObject + 2;
    const encoded = canvas.toDataURL("image/jpeg", 0.94).split(",")[1];
    if (!encoded) throw new Error("Could not encode a PDF page.");
    const jpeg = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    object(pageObject, () => text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 594] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`));
    const content = new TextEncoder().encode("q\n792 0 0 594 0 0 cm\n/Im0 Do\nQ\n");
    object(contentObject, () => { text(`<< /Length ${content.length} >>\nstream\n`); append(content); text("endstream"); });
    object(imageObject, () => { text(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); append(jpeg); text("\nendstream"); });
  });
  const xrefOffset = length;
  text(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let index = 1; index <= objectCount; index += 1) text(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  text(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  const buffers = chunks.map((chunk) => chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer);
  return new Blob(buffers, { type: "application/pdf" });
}

export function makeLongPng(pages: HTMLCanvasElement[]) {
  if (!pages.length) throw new Error("There is no notation to export yet.");
  const combined = document.createElement("canvas");
  combined.width = pages[0].width;
  combined.height = pages[0].height * pages.length;
  const context = combined.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the PNG download.");
  pages.forEach((page, index) => context.drawImage(page, 0, index * page.height));
  return combined;
}
