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

export default function ChordDiagram({ chord }: ChordDiagramProps) {
  const chart = normalizeChord(chord);
  const width = 200;
  const height = 230;
  const paddingX = 22;
  const paddingY = 32;
  const gridWidth = width - paddingX * 2;
  const gridHeight = height - paddingY * 2;
  const stringGap = gridWidth / (STRING_COUNT - 1);
  const fretGap = gridHeight / (FRET_COUNT - 1);
  const baseFret = getBaseFret(chart);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="diagram"
      role="img"
      aria-label={`Chord diagram for ${chart.name}`}
    >
      <rect x="0" y="0" width={width} height={height} rx="18" className="diagram-bg" />

      {Array.from({ length: STRING_COUNT }).map((_, index) => {
        const x = paddingX + index * stringGap;
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
          x={paddingX + chart.barre.from * stringGap - 8}
          y={paddingY + (chart.barre.fret - baseFret + 1) * fretGap - fretGap / 2 - 8}
          width={(chart.barre.to - chart.barre.from) * stringGap + 16}
          height={16}
          rx={8}
          className="diagram-barre"
        />
      )}

      {chart.frets.map((fret, stringIndex) => {
        const x = paddingX + stringIndex * stringGap;
        if (fret === 0) {
          return (
            <text key={`open-${stringIndex}`} x={x} y={paddingY - 12} className="diagram-open">
              O
            </text>
          );
        }
        if (fret < 0) {
          return (
            <text key={`mute-${stringIndex}`} x={x} y={paddingY - 12} className="diagram-mute">
              X
            </text>
          );
        }

        const position = fret - baseFret + 1;
        const y = paddingY + position * fretGap - fretGap / 2;
        const finger = chart.fingers?.[stringIndex] ?? null;

        return (
          <g key={`dot-${stringIndex}`}>
            <circle cx={x} cy={y} r={11} className="diagram-dot" />
            {finger ? (
              <text x={x} y={y + 4} className="diagram-finger">
                {finger}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
