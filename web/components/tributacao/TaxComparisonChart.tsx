"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SCENARIO_COLORS } from "@/lib/tributacao-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { TaxComparisonRowOut } from "@/lib/api-types";

type Props = {
  realEstate: TaxComparisonRowOut;
  portfolio:  TaxComparisonRowOut;
};

const WIDTH = 720;
const HEIGHT = 170;
const PAD_LEFT = 130;
const PAD_RIGHT = 110;  // accommodates "R$ XX.XXX (XX,X%)" after-bar labels when tax bar is too small to fit them inside
const PAD_TOP = 20;
const ROW_HEIGHT = 60;
const BAR_HEIGHT = 32;
const COLOR_INK = "#eaf6f4";
const COLOR_INK3 = "#7d9591";

export function TaxComparisonChart({ realEstate, portfolio }: Props) {
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const maxGross = Math.max(realEstate.grossIncome, portfolio.grossIncome, 1);

  const rows = [
    { label: "Imóvel",   row: realEstate, color: SCENARIO_COLORS.realEstate },
    { label: "Carteira", row: portfolio,  color: SCENARIO_COLORS.portfolio },
  ];

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Receita bruta vs imposto</h3>
      </CardHeader>
      <CardContent>
        <svg width={WIDTH} height={HEIGHT} role="img" aria-label="Comparativo tributário">
          {rows.map((entry, i) => {
            const yCenter = PAD_TOP + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            const yBar = yCenter - BAR_HEIGHT / 2;
            const wNet = (entry.row.netIncome / maxGross) * innerW;
            const wTax = (entry.row.annualTax / maxGross) * innerW;
            const xNet = PAD_LEFT;
            const xTax = PAD_LEFT + wNet;

            return (
              <g key={entry.label}>
                <text
                  x={PAD_LEFT - 10}
                  y={yCenter + 4}
                  fill={COLOR_INK}
                  fontSize="12"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {entry.label}
                </text>

                <rect
                  x={xNet}
                  y={yBar}
                  width={wNet}
                  height={BAR_HEIGHT}
                  fill={entry.color}
                  fillOpacity={0.85}
                />

                {wTax > 0 && (
                  <rect
                    x={xTax}
                    y={yBar}
                    width={wTax}
                    height={BAR_HEIGHT}
                    fill={SCENARIO_COLORS.tax}
                    fillOpacity={0.85}
                  />
                )}

                {wNet > 60 && (
                  <text
                    x={xNet + wNet / 2}
                    y={yCenter + 4}
                    fill={COLOR_INK}
                    fontSize="11"
                    fontWeight="600"
                    textAnchor="middle"
                    className="tabular"
                  >
                    {formatRs(entry.row.netIncome)}
                  </text>
                )}

                {wTax > 0 && (
                  <text
                    x={wTax > 80 ? xTax + wTax / 2 : xTax + wTax + 6}
                    y={yCenter + 4}
                    fill={wTax > 80 ? COLOR_INK : COLOR_INK3}
                    fontSize="11"
                    textAnchor={wTax > 80 ? "middle" : "start"}
                    className="tabular"
                  >
                    {formatRs(entry.row.annualTax)} ({formatPercent(entry.row.effectiveTaxBurden, 1)})
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SCENARIO_COLORS.realEstate }} />
            Líquido Imóvel
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SCENARIO_COLORS.portfolio }} />
            Líquido Carteira
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SCENARIO_COLORS.tax }} />
            Imposto
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
