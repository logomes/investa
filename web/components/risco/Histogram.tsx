"use client";

import { binDistribution } from "@/lib/risco-derive";
import { formatRsK } from "@/lib/format";

type Props = {
  values: number[];
  color: string;
  percentiles: { p10: number; p50: number; p90: number };
  target?: number;
  width?: number;
  height?: number;
};

const PAD_LEFT = 30;
const PAD_RIGHT = 12;
const PAD_TOP = 28;
const PAD_BOTTOM = 26;
const PERC_LABEL_Y = 14;
const COLOR_AXIS = "#506663";
const COLOR_INK3 = "#7d9591";
const COLOR_AMBER = "#FFC857";

export function Histogram({
  values,
  color,
  percentiles,
  target,
  width = 360,
  height = 220,
}: Props) {
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_TOP - PAD_BOTTOM;

  if (values.length === 0) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "auto", maxWidth: width }}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fill={COLOR_INK3} fontSize="11">
          Sem dados
        </text>
      </svg>
    );
  }

  const bins = binDistribution(values, 30);
  const min = bins[0].start;
  const max = bins[bins.length - 1].end;
  const xRange = max - min || 1;
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const xOf = (v: number) => PAD_LEFT + ((v - min) / xRange) * innerW;
  const yOf = (count: number) => PAD_TOP + innerH - (count / maxCount) * innerH;

  const verticals: Array<{ x: number; label: string; color: string; dashed: boolean }> = [
    { x: xOf(percentiles.p10), label: "p10", color: COLOR_AXIS, dashed: true },
    { x: xOf(percentiles.p50), label: "p50", color: COLOR_AXIS, dashed: true },
    { x: xOf(percentiles.p90), label: "p90", color: COLOR_AXIS, dashed: true },
  ];
  if (target !== undefined && target > 0 && target >= min && target <= max) {
    verticals.push({ x: xOf(target), label: "meta", color: COLOR_AMBER, dashed: false });
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Distribuição final" style={{ display: "block", width: "100%", height: "auto", maxWidth: width }}>
      {/* Bars */}
      {bins.map((b, i) => {
        const x = xOf(b.start);
        const w = Math.max(1, xOf(b.end) - x - 1);
        const y = yOf(b.count);
        const h = PAD_TOP + innerH - y;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            fill={color}
            fillOpacity={0.8}
          />
        );
      })}

      {/* Verticals (percentiles + optional target) */}
      {verticals.map((v) => (
        <g key={v.label}>
          <line
            x1={v.x}
            x2={v.x}
            y1={PAD_TOP - 4}
            y2={PAD_TOP + innerH}
            stroke={v.color}
            strokeWidth={v.label === "meta" ? 1.5 : 1}
            strokeDasharray={v.dashed ? "3 3" : undefined}
          />
          <text
            x={v.x}
            y={PERC_LABEL_Y}
            textAnchor="middle"
            fill={v.color}
            fontSize="10"
            fontWeight={v.label === "meta" ? 700 : 500}
          >
            {v.label}
          </text>
        </g>
      ))}

      {/* X axis ticks: min, ~p50, max */}
      <text
        x={PAD_LEFT}
        y={PAD_TOP + innerH + 14}
        textAnchor="start"
        fill={COLOR_INK3}
        fontSize="10"
      >
        {formatRsK(min)}
      </text>
      <text
        x={xOf(percentiles.p50)}
        y={PAD_TOP + innerH + 14}
        textAnchor="middle"
        fill={COLOR_INK3}
        fontSize="10"
      >
        {formatRsK(percentiles.p50)}
      </text>
      <text
        x={PAD_LEFT + innerW}
        y={PAD_TOP + innerH + 14}
        textAnchor="end"
        fill={COLOR_INK3}
        fontSize="10"
      >
        {formatRsK(max)}
      </text>
    </svg>
  );
}
