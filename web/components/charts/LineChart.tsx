type Series = {
  name: string;
  color: string;
  values: number[];
  dash?: string;
  width?: number;
};

type Band = {
  name: string;
  color: string;
  lower: number[];
  upper: number[];
};

type Pad = { t: number; r: number; b: number; l: number };

type Props = {
  series: Series[];
  bands?: Band[];
  xLabels: string[];
  width?: number;
  height?: number;
  pad?: Pad;
  yFormat?: (v: number) => string;
  showLastLabel?: boolean;
  gridColor?: string;
  axisColor?: string;
};

// Right pad accommodates the last-value labels (`R$XXXk`) printed past the
// final marker. ~70px fits "R$ 1.235k" without clipping.
const DEFAULT_PAD: Pad = { t: 12, r: 72, b: 28, l: 56 };

function defaultYFormat(v: number): string {
  return `R$${(v / 1000).toFixed(0)}k`;
}

function lineFor(values: number[], xFn: (i: number) => number, yFn: (v: number) => number): string {
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xFn(i)} ${yFn(v)}`)
    .join(" ");
}

function areaFor(
  lower: number[],
  upper: number[],
  xFn: (i: number) => number,
  yFn: (v: number) => number,
): string {
  const upperPath = upper
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xFn(i)} ${yFn(v)}`)
    .join(" ");
  const lowerReversed = [...lower]
    .reverse()
    .map((v, i) => `L ${xFn(lower.length - 1 - i)} ${yFn(v)}`)
    .join(" ");
  return `${upperPath} ${lowerReversed} Z`;
}

export function LineChart({
  series,
  bands,
  xLabels,
  width = 780,
  height = 300,
  pad = DEFAULT_PAD,
  yFormat = defaultYFormat,
  showLastLabel = true,
  gridColor = "#162428",
  axisColor = "#7d9591",
}: Props) {
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const allValues = [
    ...series.flatMap((s) => s.values),
    ...(bands ?? []).flatMap((b) => [...b.lower, ...b.upper]),
  ];
  const yMin = 0;
  const yMax = Math.max(...allValues, 1) * 1.05;
  const xMax = Math.max(...series.map((s) => s.values.length - 1), 1);

  const x = (i: number) => pad.l + (i / xMax) * innerW;
  const y = (v: number) => pad.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const yTicks = 5;
  const yVals = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (i * (yMax - yMin)) / yTicks);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", width: "100%", height: "auto", maxWidth: width }}
    >
      {/* Grid + Y labels */}
      {yVals.map((v, i) => (
        <g key={`y${i}`}>
          <line x1={pad.l} x2={pad.l + innerW} y1={y(v)} y2={y(v)} stroke={gridColor} />
          <text
            x={pad.l - 8}
            y={y(v) + 3}
            textAnchor="end"
            fill={axisColor}
            fontSize="10"
            fontFamily="inherit"
          >
            {yFormat(v)}
          </text>
        </g>
      ))}

      {/* Bands */}
      {(bands ?? []).map((b, i) => (
        <path key={`b${i}`} d={areaFor(b.lower, b.upper, x, y)} fill={b.color} />
      ))}

      {/* Series */}
      {series.map((s, i) => (
        <path
          key={`s${i}`}
          d={lineFor(s.values, x, y)}
          stroke={s.color}
          strokeWidth={s.width ?? 1.5}
          strokeDasharray={s.dash ?? "none"}
          fill="none"
        />
      ))}

      {/* Last value markers + labels (with vertical collision avoidance:
          marker stays at the true Y; if labels overlap they're nudged down) */}
      {showLastLabel && (() => {
        const minGap = 12;
        const items = series.map((s, i) => {
          const lastI = s.values.length - 1;
          return {
            i,
            color: s.color,
            cx: x(lastI),
            cy: y(s.values[lastI]),
            text: yFormat(s.values[lastI]),
          };
        });
        const order = [...items].sort((a, b) => a.cy - b.cy);
        const labelY = new Map<number, number>();
        let prev = -Infinity;
        for (const l of order) {
          const ty = Math.max(l.cy, prev + minGap);
          labelY.set(l.i, ty);
          prev = ty;
        }
        return items.map((l) => (
          <g key={`lbl${l.i}`}>
            <circle cx={l.cx} cy={l.cy} r="3" fill={l.color} />
            <text
              x={l.cx + 6}
              y={(labelY.get(l.i) as number) + 3}
              fill={l.color}
              fontSize="10"
              fontFamily="inherit"
              fontWeight="700"
            >
              {l.text}
            </text>
          </g>
        ));
      })()}

      {/* X axis labels */}
      {xLabels.map((lbl, i) => (
        <text
          key={`x${i}`}
          x={x(i)}
          y={pad.t + innerH + 14}
          textAnchor="middle"
          fill={axisColor}
          fontSize="10"
          fontFamily="inherit"
        >
          {lbl}
        </text>
      ))}
    </svg>
  );
}
