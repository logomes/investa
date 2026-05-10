"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { tornadoBounds, type SensitivityRow } from "@/lib/sensibilidade-derive";
import { formatRs, formatRsK } from "@/lib/format";

type Props = { rows: SensitivityRow[]; base: number };

const ROW_HEIGHT = 38;
const PAD_LEFT = 170;
const PAD_RIGHT = 100;
const PAD_TOP = 50;
const PAD_BOTTOM = 30;
const WIDTH = 780;
const COLOR_CORAL = "#FF5D72";
const COLOR_GREEN = "#46E8A4";
const COLOR_AXIS = "#506663";
const COLOR_INK = "#eaf6f4";
const COLOR_INK3 = "#7d9591";

export function TornadoChart({ rows, base }: Props) {
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const height = PAD_TOP + rows.length * ROW_HEIGHT + PAD_BOTTOM;
  const bounds = tornadoBounds(rows, base);
  const range = bounds.max - bounds.min;
  const xOf = (v: number) => PAD_LEFT + ((v - bounds.min) / range) * innerW;
  const xBase = xOf(base);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Tornado — sensibilidade do patrimônio</h3>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tornado de sensibilidade" style={{ display: "block", width: "100%", height: "auto", maxWidth: WIDTH }}>
          <text x={PAD_LEFT} y={PAD_TOP - 18} fill={COLOR_INK3} fontSize="10" textAnchor="start">
            {formatRsK(bounds.min)}
          </text>
          <text x={xBase} y={PAD_TOP - 18} fill={COLOR_INK} fontSize="10" textAnchor="middle" fontWeight="700">
            Base {formatRs(base)}
          </text>
          <text x={PAD_LEFT + innerW} y={PAD_TOP - 18} fill={COLOR_INK3} fontSize="10" textAnchor="end">
            {formatRsK(bounds.max)}
          </text>

          <line
            x1={xBase}
            x2={xBase}
            y1={PAD_TOP - 6}
            y2={PAD_TOP + rows.length * ROW_HEIGHT}
            stroke={COLOR_AXIS}
            strokeDasharray="2 2"
          />

          {rows.map((row, i) => {
            const yCenter = PAD_TOP + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            const barH = 22;
            const yBar = yCenter - barH / 2;

            const segments = [
              { impact: row.pessImpact, key: "pess" },
              { impact: row.optImpact,  key: "opt"  },
            ];

            return (
              <g key={row.parameter}>
                <text
                  x={PAD_LEFT - 10}
                  y={yCenter + 4}
                  fill={COLOR_INK}
                  fontSize="11"
                  textAnchor="end"
                >
                  {row.label}
                </text>

                {segments.map(({ impact, key }) => {
                  if (impact === 0) return null;
                  const xEnd = xOf(base + impact);
                  const x = Math.min(xBase, xEnd);
                  const w = Math.abs(xEnd - xBase);
                  const fill = impact < 0 ? COLOR_CORAL : COLOR_GREEN;
                  return (
                    <rect
                      key={key}
                      x={x}
                      y={yBar}
                      width={w}
                      height={barH}
                      fill={fill}
                      fillOpacity={0.85}
                    />
                  );
                })}

                <text
                  x={PAD_LEFT + innerW + 10}
                  y={yCenter + 4}
                  fill={COLOR_INK3}
                  fontSize="11"
                  textAnchor="start"
                  className="tabular"
                >
                  {formatRsK(row.amplitude)}
                </text>
              </g>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}
