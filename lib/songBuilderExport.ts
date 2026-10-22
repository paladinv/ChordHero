import type { LibrarySong } from "./songLibrary";
import { buildSongTimeline, measureQuarterBeats, meterParts, type TimelineBar } from "./songBuilder";

export type NotationView = "tab" | "staff" | "both";
export type NotationLayout = { barsPerLine?: number; trackId?: string; diagrams?: boolean; sectionBreaks?: boolean };
export type PdfPaper = "letter" | "a4";
export type PdfOrientation = "landscape" | "portrait";
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

function staffStep(midi: number, key = "C") {
  const letter = pitchName(midi, key)[0];
  const step = ({ C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 } as Record<string, number>)[letter];
  return (Math.floor(midi / 12) - 1) * 7 + step;
}

function percussionStaffY(midi: number, top: number, bottom: number, lineGap: number) {
  if (midi === 35 || midi === 36) return bottom;
  if (midi >= 37 && midi <= 40) return bottom - lineGap;
  if (midi === 42 || midi === 44 || midi === 46) return top;
  if (midi === 45) return bottom - lineGap * 0.5;
  if (midi === 47) return bottom - lineGap * 1.5;
  if (midi === 48 || midi === 50) return bottom - lineGap * 2;
  if (midi >= 49) return top - lineGap * 0.5;
  return bottom - lineGap;
}

function percussionName(midi: number) {
  if (midi === 35 || midi === 36) return "BD";
  if (midi >= 37 && midi <= 40) return "SD";
  if (midi === 42 || midi === 44 || midi === 46) return "HH";
  if ([49, 51, 53, 55, 57, 59].includes(midi)) return "Cym";
  if (midi >= 45 && midi <= 50) return "Tom";
  return "Cym";
}

function keyFifths(key:string){return ({C:0,G:1,D:2,A:3,E:4,B:5,"F#":6,"C#":7,F:-1,Bb:-2,Eb:-3,Ab:-4,Db:-5,Gb:-6,Am:0,Em:1,Bm:2,"F#m":3,"C#m":4,"G#m":5,Dm:-1,Gm:-2,Cm:-3,Fm:-4,Bbm:-5,Ebm:-6} as Record<string,number>)[key]??0;}
function restSymbol(context:CanvasRenderingContext2D,x:number,y:number,beats:number,widthPerBeat=20){
 const values=[4,3,2,1.5,1,.75,.5,.375,1/3,.25,.125];
 let remaining=beats;let offset=0;let count=0;
 while(remaining>.001&&count++<32){const length=values.find(value=>value<=remaining+.001)??remaining;const at=x+offset*widthPerBeat;context.fillStyle=ink;
  if(length>=2)context.fillRect(at-5,y+(length>=4?0:-4),10,4);else{context.font="22px serif";context.fillText(length>=1?"𝄽":length>=.5?"𝄾":"𝄿",at-4,y+12);}
  if([3,1.5,.75,.375].some(value=>Math.abs(value-length)<.001)){context.beginPath();context.arc(at+12,y+3,1.8,0,Math.PI*2);context.fill();}
  if(Math.abs(length-1/3)<.001){context.font="9px Arial";context.fillText("3",at,y-4);}remaining-=length;offset+=length;
 }
}


function clearPage(context: CanvasRenderingContext2D) {
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, BUILDER_SHEET_WIDTH, BUILDER_SHEET_HEIGHT);
}

function drawNotationSystem(song: LibrarySong, bars: TimelineBar[], view: NotationView, pageIndex: number, cursor?: { barIndex: number; fraction: number } | null) {
  const canvas = document.createElement("canvas");
  canvas.width = BUILDER_SHEET_WIDTH;
  canvas.height = BUILDER_SHEET_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the notation preview.");
  clearPage(context);

  const pageBars = bars.slice(pageIndex * BUILDER_PAGE_BARS, (pageIndex + 1) * BUILDER_PAGE_BARS);
  const tracks = song.composition?.tracks ?? [];
  const perTrack = tracks.length ? Math.floor((640 - Math.max(0, tracks.length - 1) * 16) / tracks.length) : 120;
  const trackHeight = Math.max(view === "tab" ? 78 : 105, Math.min(view === "tab" ? 178 : 200, perTrack));
  const firstBar = pageBars[0];

  context.fillStyle = ink;
  context.font = "700 30px Georgia, serif";
  context.fillText(song.title || "Untitled song", 62, 60, 720);
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

  const left = 172;
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
    context.fillText(track.name, 62, top + 17, 220);
    context.font = "12px Arial, sans-serif";
    context.fillStyle = muted;
    context.fillText(`${track.instrument} · ${track.tuningLabel}${track.capo ? ` · capo ${track.capo}` : ""}`, 300, top + 17, 820);

    if (view === "tab") {
      const tabTop = top + 68;
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
        context.fillText(`${bar.index + 1} · ${bar.sectionTitle}${bar.repeat > 1 ? ` ${bar.repeat}` : ""}`, x1 + 7, top + 42, barWidth - 14);
        context.font = "11px Arial, sans-serif";
        context.fillStyle = muted;
        context.textAlign = "right"; context.fillText(bar.meter, x2 - 9, top + 42); context.textAlign = "left";
        for (const cue of bar.events.filter((item) => item.track.id === track.id)) {
          const x = x1 + 7 + (cue.event.startBeat / bar.measureBeats) * Math.max(1, barWidth - 15);
          if (cue.event.kind === "rest") { context.fillStyle = ink; context.font = "18px serif"; context.fillText("𝄽", x, tabTop + 20); }
          if (cue.event.technique || cue.event.tie) { context.font = "9px Arial, sans-serif"; context.fillStyle = muted; context.fillText(`${cue.event.technique ?? ""}${cue.event.tie ? " ~" : ""}`, x, tabTop + (stringCount - 1) * lineGap + 18); }
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
      const staffTop = top + 86;
      const staffBottom = staffTop + lineGap * 4;
      context.strokeStyle = "#77766f";
      context.lineWidth = 1;
      for (let line = 0; line < 5; line += 1) { const y = staffTop + line * lineGap; context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke(); }
      context.fillStyle = teal;
      context.font = "38px serif";
      context.fillText(track.instrument === "bass" ? "𝄢" : track.instrument === "percussion" ? "Perc." : "𝄞", 65, staffTop + 42);
      if (track.instrument === "guitar") {
        context.font = "700 12px Arial, sans-serif";
        context.fillText("8", 81, staffTop + 65);
      }
      const fifths=keyFifths(song.composition?.key??song.key); context.font="17px serif";context.fillStyle=ink;
      const offsets=fifths>=0?[0,3,-1,2,5,1,4]:[4,1,5,2,6,3,7];
      if (track.instrument !== "percussion") for(let i=0;i<Math.abs(fifths);i++)context.fillText(fifths>0?"♯":"♭",106+i*7,staffTop+(track.instrument==="bass"?(offsets[i]+10)%7:offsets[i])*6+3);
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
        context.fillText(`${bar.index + 1} · ${bar.sectionTitle}`, x1 + 7, top + 42, barWidth - 12);
        context.fillStyle = muted;
        context.font = "11px Arial, sans-serif";
        context.textAlign = "right"; context.fillText(bar.meter, x2 - 9, top + 42); context.textAlign = "left";
        const accidentalState=new Map<string,number>();
        const partEvents=bar.events.filter(item=>item.track.id===track.id);
        const beamGroups=new Map<number,typeof partEvents>();const groupSize=/^(6|9|12)\/8$/.test(bar.meter)?1.5:1;
        for(const cue of partEvents)if(cue.event.kind!=="rest"&&!cue.event.grace&&cue.event.durationBeats<1){const group=Math.floor(cue.event.startBeat/groupSize);beamGroups.set(group,[...(beamGroups.get(group)??[]),cue]);}
        const beamed=new Set([...beamGroups.values()].filter(group=>group.length>1).flatMap(group=>group.map(cue=>cue.event.id)));
        const occupied=partEvents.filter(cue=>!cue.event.grace).slice().sort((a,b)=>a.event.startBeat-b.event.startBeat);let restAt=0;
        for(const cue of occupied){if(cue.event.startBeat>restAt+.01)restSymbol(context,x1+15+(restAt/bar.measureBeats)*(barWidth-30),staffTop+18,cue.event.startBeat-restAt,(barWidth-30)/bar.measureBeats);restAt=Math.max(restAt,cue.event.startBeat+cue.event.durationBeats);}
        if(restAt<bar.measureBeats-.01)restSymbol(context,occupied.length?x1+15+(restAt/bar.measureBeats)*(barWidth-30):x1+barWidth/2,staffTop+18,occupied.length?bar.measureBeats-restAt:bar.measureBeats===measureQuarterBeats(bar.meter)?4:bar.measureBeats,(barWidth-30)/bar.measureBeats);
        for (const cue of partEvents) {
          const x = x1 + 15 + (cue.event.startBeat / bar.measureBeats) * Math.max(1, barWidth - 30);
          if (cue.event.kind === "chord") {
            context.fillStyle = teal;
            context.font = "700 12px Arial, sans-serif";
            context.textAlign = "center";
            context.fillText(cue.event.chord ?? "Chord", x, staffTop - 8);
          }
          if (cue.event.kind === "rest") {
            context.font = "22px serif"; context.fillText(cue.event.durationBeats >= 2 ? "𝄼" : "𝄽", x, staffTop + 29);
          }
          if(cue.event.dynamic){context.font="italic 12px serif";context.fillText(cue.event.dynamic,x,staffBottom+37);}
          if(cue.event.articulation){context.font="14px serif";context.fillText(cue.event.articulation==="staccato"?"•":cue.event.articulation==="tenuto"?"—":"^",x,staffTop-12);}
          const writtenPitches = cue.pitches.map((midi) => midi + (track.instrument === "guitar" ? 12 : 0));
          const scoreKey = song.composition?.key ?? song.key;
          const noteYs = writtenPitches.map((midi) => track.instrument === "percussion" ? percussionStaffY(midi, staffTop, staffBottom, lineGap) : staffBottom - (staffStep(midi, scoreKey) - baseStep) * (lineGap / 2));
          writtenPitches.forEach((midi, pitchIndex) => {
            const y = noteYs[pitchIndex];
            const staffIndex = staffStep(midi, scoreKey);
            const collidesBySecond = track.instrument !== "percussion" && writtenPitches.some((other, otherIndex) => otherIndex !== pitchIndex && Math.abs(staffStep(other, scoreKey) - staffIndex) === 1);
            const noteX = x + (collidesBySecond ? pitchIndex % 2 === 0 ? -4 : 4 : 0);
            context.strokeStyle = ink; context.lineWidth = 1;
            if (track.instrument !== "percussion") {
              for (let ledger = staffBottom + lineGap; ledger <= y + 1; ledger += lineGap) { context.beginPath(); context.moveTo(noteX - 10, ledger); context.lineTo(noteX + 10, ledger); context.stroke(); }
              for (let ledger = staffTop - lineGap; ledger >= y - 1; ledger -= lineGap) { context.beginPath(); context.moveTo(noteX - 10, ledger); context.lineTo(noteX + 10, ledger); context.stroke(); }
              const spelled = pitchName(midi, scoreKey);
              const alteration=spelled.includes("#")?1:spelled.includes("b")?-1:0;const accidentalKey=spelled[0]+Math.floor(midi/12);const alteredLetters=(fifths>=0?"FCGDAEB":"BEADGCF").slice(0,Math.abs(fifths));const expected=accidentalState.get(accidentalKey)??(alteredLetters.includes(spelled[0])?Math.sign(fifths):0);
              if(alteration!==expected){context.font="16px serif";context.fillText(alteration===1?"♯":alteration===-1?"♭":"♮",noteX-14,y+5);}accidentalState.set(accidentalKey,alteration);
            }
            if ([0.375, 0.75, 1.5, 3, 6].some((value) => Math.abs(value - cue.event.durationBeats) < 0.001)) { context.fillStyle = ink; context.beginPath(); context.arc(noteX + 12, y - 2, 2, 0, Math.PI * 2); context.fill(); }
            if (cue.event.tie) { context.beginPath(); context.moveTo(noteX, y + 8); context.quadraticCurveTo(noteX + 14, y + 22, noteX + 28, y + 8); context.stroke(); }
            if (cue.event.technique) { context.font = "9px Arial, sans-serif"; context.fillText(cue.event.technique, noteX, staffTop - 21); }
            const baseDuration = [0.375, 0.75, 1.5, 3, 6].some((value) => Math.abs(value - cue.event.durationBeats) < 0.001) ? cue.event.durationBeats / 1.5 : cue.event.durationBeats;
            const openHead = baseDuration >= 2;
            context.fillStyle = ink;
            const unpitched = track.instrument === "percussion" && [42, 44, 46, 49, 51, 53, 55, 57, 59].includes(midi);
            if (unpitched) {
              context.beginPath(); context.moveTo(noteX - 5, y - 5); context.lineTo(noteX + 5, y + 5); context.moveTo(noteX + 5, y - 5); context.lineTo(noteX - 5, y + 5); context.stroke();
            } else {
              context.beginPath(); context.ellipse(noteX, y, cue.event.grace?4:6.5, cue.event.grace?3:4.6, -0.25, 0, Math.PI * 2);
            }
            if (openHead) { context.fillStyle = "#fffdf8"; context.fill(); context.strokeStyle = ink; context.lineWidth = 1.6; context.stroke(); }
            else context.fill();
            context.strokeStyle = ink;
            if (baseDuration < 4 && !beamed.has(cue.event.id) && pitchIndex === 0) {
              context.lineWidth = 1.4;
              const centerY = noteYs.reduce((sum, value) => sum + value, 0) / noteYs.length;
              const direction = centerY < staffTop + lineGap * 2 ? 1 : -1;
              const stemOrigin = direction === 1 ? Math.max(...noteYs) : Math.min(...noteYs);
              const stemX = x + (direction === 1 ? -6 : 6);
              context.beginPath(); context.moveTo(stemX, stemOrigin); context.lineTo(stemX, stemOrigin + direction * 26); context.stroke();
              const flags = baseDuration <= 0.25 ? 2 : baseDuration < 1 ? 1 : 0;
              for (let flag = 0; flag < flags; flag += 1) {
                context.beginPath(); context.moveTo(stemX, stemOrigin + direction * (26 - flag * 7)); context.quadraticCurveTo(stemX + 11, stemOrigin + direction * (23 - flag * 7), stemX + 6, stemOrigin + direction * (16 - flag * 7)); context.stroke();
              }
              if (cue.event.tuplet || Math.abs(cue.event.durationBeats - 1 / 3) < 0.01) { context.font = "9px Arial, sans-serif"; context.fillStyle = muted; context.fillText(String(cue.event.tuplet ?? 3), noteX + 10, stemOrigin - 26); }
            }
            context.font = "9px Arial, sans-serif";
            context.fillStyle = muted;
            context.textAlign = "center";
            if (writtenPitches.length === 1 && !beamed.has(cue.event.id)) context.fillText(track.instrument === "percussion" ? percussionName(midi) : pitchName(midi, song.composition?.key ?? song.key), noteX, staffBottom + 21);
            if (cue.event.lyric && pitchIndex === 0) {
              const lyricIsActive = cursor?.barIndex === bar.index && cursor.fraction >= cue.event.startBeat / bar.measureBeats && cursor.fraction < (cue.event.startBeat + cue.event.durationBeats) / bar.measureBeats;
              context.fillStyle = lyricIsActive ? coral : teal;
              context.font = `${lyricIsActive ? "700 " : ""}12px Arial, sans-serif`;
              context.fillText(cue.event.lyric, noteX, staffBottom + 43, Math.max(46, barWidth / 2));
            }
          });
        }
        for(const group of beamGroups.values())if(group.length>1){
          const points=group.map(cue=>({cue,x:x1+15+(cue.event.startBeat/bar.measureBeats)*(barWidth-30),y:staffBottom-(staffStep((cue.pitches[0]??64)+(track.instrument==="guitar"?12:0),song.composition?.key??song.key)-baseStep)*lineGap/2}));
          const up=Math.min(...points.map(point=>point.y))-25>top+48;const beamY=up?Math.min(...points.map(point=>point.y))-25:Math.max(...points.map(point=>point.y))+25;
          context.strokeStyle=ink;context.lineWidth=4;context.beginPath();context.moveTo(points[0].x+(up?6:-6),beamY);context.lineTo(points.at(-1)!.x+(up?6:-6),beamY);context.stroke();
          for(const point of points){context.lineWidth=1.4;context.beginPath();context.moveTo(point.x+(up?6:-6),point.y);context.lineTo(point.x+(up?6:-6),beamY);context.stroke();if(point.cue.event.durationBeats<=.25){context.lineWidth=3;context.beginPath();context.moveTo(point.x+(up?6:-6),beamY+(up?7:-7));context.lineTo(point.x+(up?17:5),beamY+(up?7:-7));context.stroke();}}
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

type NotationBlock = { bars: TimelineBar[]; trackId: string; view: "tab" | "staff"; height: number };
export function notationPageGroups(song: LibrarySong, bars: TimelineBar[], view: NotationView, layout: NotationLayout = {}): NotationBlock[][] {
  const tracks = (song.composition?.tracks ?? []).filter((track) => !layout.trackId || track.id === layout.trackId);
  const barsPerLine = Math.max(1, Math.min(4, layout.barsPerLine ?? 4));
  const pages: NotationBlock[][] = []; let page: NotationBlock[] = []; let height = 0;
  const flush = () => { if (page.length) pages.push(page); page = []; height = 0; };
  let row: TimelineBar[] = [];
  const appendRow = () => {
    if (!row.length) return;
    for (const track of tracks) {
      // Keep each combined staff and tab pair together.
      const stringed = ["guitar", "ukulele", "bass"].includes(track.instrument);
      const modes = view === "both" ? stringed ? ["staff", "tab"] as const : ["staff"] as const : [view === "tab" && !stringed ? "staff" : view] as const;
      const required = modes.reduce((sum, mode) => sum + (mode === "staff" ? 206 : 196), 0);
      if (height + required > (layout.diagrams ? 520 : 640)) flush();
      for (const mode of modes) {
        const blockHeight = mode === "staff" ? 206 : 196;
        page.push({ bars: row, trackId: track.id, view: mode, height: blockHeight });
      }
      height += required;
    }
    row = [];
  };
  for (const bar of bars) {
    const previous = row.at(-1);
    const section = song.composition?.sections.find((item) => item.id === bar.sectionId);
    const startsSection = bar.measureIndex === 0 && bar.repeat === 1;
    if (startsSection && (layout.sectionBreaks || section?.pageBreak)) { appendRow(); flush(); }
    else if (previous && previous.sectionId !== bar.sectionId) appendRow();
    const density = Math.max(0,...tracks.map(track=>new Set(bar.events.filter(cue=>cue.track.id===track.id).map(cue=>cue.event.startBeat)).size));
    const limit = density>8?1:density>4?Math.min(2,barsPerLine):barsPerLine;
    if(row.length>=limit)appendRow();
    row.push(bar);
    if (row.length >= limit) appendRow();
  }
  appendRow(); flush();
  return pages.length ? pages : [[]];
}

export function drawNotationPage(song: LibrarySong, bars: TimelineBar[], view: NotationView, pageIndex: number, cursor?: { barIndex: number; fraction: number } | null, layout: NotationLayout = {}) {
  const pages = notationPageGroups(song, bars, view, layout);
  const blocks = pages[Math.max(0, Math.min(pageIndex, pages.length - 1))] ?? [];
  const blank = { ...song, composition: song.composition ? { ...song.composition, tracks: [] } : undefined };
  const canvas = drawNotationSystem(blank, blocks[0]?.bars ?? [], "tab", 0);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fffdf8"; context.fillRect(0, 113, 1200, 787);
  context.fillStyle = teal; context.font = "700 14px Arial, sans-serif"; context.textAlign = "right";
  context.fillText(view === "both" ? "STANDARD NOTATION + TABLATURE" : view === "tab" ? "TABLATURE" : "STANDARD NOTATION", 1138, 60); context.textAlign = "left";
  let top = 126;
  for (const block of blocks) {
    const track = song.composition?.tracks.find((item) => item.id === block.trackId);
    if (!track || !song.composition) continue;
    const partSong = { ...song, composition: { ...song.composition, tracks: [track] } };
    const system = drawNotationSystem(partSong, block.bars, block.view, 0, cursor);
    // Keep instrument labels, meter, and score on separate baselines.
    context.drawImage(system, 0, 142, 1200, block.height - 6, 0, top, 1200, block.height - 6);
    if (cursor) {
      const index = block.bars.findIndex((bar) => bar.index === cursor.barIndex);
      if (index >= 0) { const width = 966 / block.bars.length; const x = 172 + (index + Math.max(0, Math.min(1, cursor.fraction))) * width; context.strokeStyle = coral; context.lineWidth = 3; context.beginPath(); context.moveTo(x, top); context.lineTo(x, top + block.height - 12); context.stroke(); }
    }
    top += block.height;
  }
  const annotations = [...new Set(blocks.flatMap((block) => block.bars.map((bar) => bar.sectionId)))].flatMap((id) => {
    const section = song.composition?.sections.find((item) => item.id === id);
    return [section?.lyrics ? `${section.title}: ${section.lyrics.replace(/\n/g, " / ")}` : "", section?.notes ?? ""].filter(Boolean);
  });
  context.fillStyle = muted; context.font = "11px Arial, sans-serif";
  annotations.slice(0, 2).forEach((text, index) => context.fillText(text, 62, 802 + index * 15, 1076));
  if (layout.diagrams) {
    const chords = blocks.flatMap((block) => block.bars.flatMap((bar) => bar.events.filter((cue) => cue.track.id === block.trackId && cue.event.kind === "chord" && cue.event.voicing).map((cue) => cue.event)));
    const unique = chords.filter((event, i) => chords.findIndex((other) => other.chord === event.chord && other.voicing?.join() === event.voicing?.join()) === i).slice(0, 8);
    const diagramTop = Math.min(top + 16, 680);
    if (top < 720) unique.forEach((event, i) => {
      const x = 72 + i * 132; const frets = event.voicing!; const pressed = frets.filter((f): f is number => f !== null && f > 0); const base = Math.max(1, Math.min(...pressed));
      context.fillStyle = teal; context.font = "bold 11px Arial"; context.fillText(event.chord ?? "", x, diagramTop - 6); context.strokeStyle = muted; context.lineWidth = 1;
      for (let row = 0; row < 5; row++) { context.beginPath(); context.moveTo(x, diagramTop + row * 12); context.lineTo(x + (frets.length - 1) * 12, diagramTop + row * 12); context.stroke(); }
      frets.forEach((fret, string) => { const sx = x + string * 12; context.beginPath(); context.moveTo(sx, diagramTop); context.lineTo(sx, diagramTop + 48); context.stroke(); context.font = "9px Arial"; context.fillText(fret === null ? "×" : fret === 0 ? "○" : "", sx - 3, diagramTop - 1); if (fret !== null && fret > 0) { context.beginPath(); context.arc(sx, diagramTop + (fret - base + 0.5) * 12, 4, 0, Math.PI * 2); context.fill(); } });
      context.fillText(`fret ${base}`, x + frets.length * 12, diagramTop + 10);
    });
  }
  context.fillStyle = muted; context.font = "12px Arial"; context.fillText(`${pageIndex + 1} / ${pages.length}`, 62, 865);
  context.textAlign = "right"; context.fillStyle = teal; context.fillText("Chord Hero · Song Builder", 1138, 865); context.textAlign = "left";
  return canvas;
}

export function renderNotationPages(song: LibrarySong, view: NotationView, sectionId?: string, cursor?: { barIndex: number; fraction: number } | null, layout: NotationLayout = {}) {
  const bars = buildSongTimeline(song, sectionId).bars;
  return notationPageGroups(song, bars, view, layout).map((_, index) => drawNotationPage(song, bars, view, index, cursor, layout));
}

export function renderLeadSheetPages(song: LibrarySong, sectionId?: string) {
  const sections = (song.composition?.sections ?? []).filter((section) => !sectionId || section.id === sectionId);
  if (!sections.length) throw new Error("There is no composition section to export.");
  const pages: HTMLCanvasElement[] = [];
  const makePage = () => {
    const canvas = document.createElement("canvas");
    canvas.width = BUILDER_SHEET_WIDTH; canvas.height = BUILDER_SHEET_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the lead sheet.");
    clearPage(context);
    context.fillStyle = ink; context.font = "700 30px Georgia, serif"; context.fillText(song.title || "Untitled song", 62, 58, 820);
    context.fillStyle = muted; context.font = "16px Arial, sans-serif";
    context.fillText(`${song.artist || "Original composition"} · ${song.composition?.key ?? song.key} · ${song.composition?.bpm ?? song.bpm} BPM · ${song.composition?.timeSignature ?? song.timeSignature}`, 64, 86, 1070);
    context.strokeStyle = "#d8d1c5"; context.beginPath(); context.moveTo(62, 108); context.lineTo(1138, 108); context.stroke();
    pages.push(canvas);
    return { canvas, context, y: 140 };
  };
  const wrap = (context: CanvasRenderingContext2D, value: string, width: number) => {
    const lines: string[] = [];
    let line = "";
    for (const word of value.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > width) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  let page = makePage();
  for (const section of sections) {
    if (page.y > 710) page = makePage();
    page.context.fillStyle = teal; page.context.font = "700 20px Georgia, serif"; page.context.fillText(section.title, 64, page.y); page.y += 28;
    const measureTotal = Math.max(1, ...song.composition!.tracks.map((track) => section.measuresByTrack[track.id]?.length ?? 0));
    const chordTrack = song.composition!.tracks.find((track) => (section.measuresByTrack[track.id] ?? []).some((bar) => bar.events.some((event) => event.kind === "chord")));
    if (chordTrack) {
      page.context.font = "700 15px Arial, sans-serif"; page.context.fillStyle = ink;
      for (let start = 0; start < measureTotal; start += 4) {
        if (page.y > 770) page = makePage();
        const entries = Array.from({ length: Math.min(4, measureTotal - start) }, (_, index) => {
          const chords = (section.measuresByTrack[chordTrack.id]?.[start + index]?.events ?? []).filter((event) => event.kind === "chord").map((event) => event.chord).filter(Boolean).join(" / ");
          return `${start + index + 1}. ${chords || "—"}`;
        });
        entries.forEach((entry, index) => page.context.fillText(entry, 68 + index * 265, page.y, 245));
        page.y += 24;
      }
    }
    for (const [label, value] of [["Lyrics", section.lyrics], ["Notes", section.notes]] as const) {
      if (!value?.trim()) continue;
      if (page.y > 750) page = makePage();
      page.context.fillStyle = teal; page.context.font = "700 13px Arial, sans-serif"; page.context.fillText(label, 66, page.y); page.y += 18;
      page.context.fillStyle = ink; page.context.font = "16px Arial, sans-serif";
      const lines = value.split(/\r?\n/).flatMap((line) => line ? wrap(page.context, line, 1050) : [""]);
      for (const line of lines) {
        if (page.y > 790) { page = makePage(); page.context.fillStyle = teal; page.context.font = "700 13px Arial, sans-serif"; page.context.fillText(`${section.title} · continued`, 66, page.y); page.y += 20; page.context.fillStyle = ink; page.context.font = "16px Arial, sans-serif"; }
        page.context.fillText(line, 66, page.y, 1050); page.y += 22;
      }
      page.y += 8;
    }
  }
  pages.forEach((item, index) => {
    const context = item.getContext("2d")!;
    context.fillStyle = muted; context.font = "12px Arial, sans-serif"; context.fillText(`Lead sheet · ${index + 1} / ${pages.length}`, 62, 860);
    context.textAlign = "right"; context.fillStyle = teal; context.font = "700 12px Arial, sans-serif"; context.fillText("Chord Hero · Song Builder", 1138, 860); context.textAlign = "left";
  });
  return pages;
}

export function canvasPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the PNG image.")), "image/png"));
}

export function canvasesPdf(canvases: HTMLCanvasElement[], paper: PdfPaper = "letter", orientation: PdfOrientation = "landscape") {
  if (!canvases.length) throw new Error("There is no notation to export yet.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  const append = (chunk: Uint8Array) => { chunks.push(chunk); length += chunk.length; };
  const text = (value: string) => append(new TextEncoder().encode(value));
  const offsets: number[] = [0];
  const objectCount = 2 + canvases.length * 3;
  const paperSize = paper === "a4" ? [595.28, 841.89] : [612, 792];
  const [pageWidth, pageHeight] = orientation === "landscape" ? [paperSize[1], paperSize[0]] : paperSize;
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
    const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const imageWidth = canvas.width * scale;
    const imageHeight = canvas.height * scale;
    const left = (pageWidth - imageWidth) / 2;
    const bottom = (pageHeight - imageHeight) / 2;
    object(pageObject, () => text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`));
    const content = new TextEncoder().encode(`q\n${imageWidth} 0 0 ${imageHeight} ${left} ${bottom} cm\n/Im0 Do\nQ\n`);
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
