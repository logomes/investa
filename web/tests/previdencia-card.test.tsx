import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrevidenciaCard } from "@/components/tributacao/PrevidenciaCard";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import { comparePrevidencia } from "@/lib/previdencia";
import { formatRs } from "@/lib/format";

function setScenario(horizon: number, annualRate: number) {
  useScenarioStore.setState({
    displayMode: "nominal",
    scenario: {
      ...DEFAULT_SCENARIO,
      horizon,
      benchmark: { ...DEFAULT_SCENARIO.benchmark, annualRate },
    },
  });
}

describe("PrevidenciaCard", () => {
  beforeEach(() => {
    // Reset to a neutral baseline before each case.
    setScenario(10, 0.08);
  });

  it("renderiza líquido PGBL/VGBL para o input default (h=12, 8%) e mostra veredito PGBL", () => {
    // h=12 + defaults (renda 120k, aporte 14,4k, alíquota 27,5%) → PGBL vence.
    setScenario(12, 0.08);
    render(<PrevidenciaCard />);

    const r = comparePrevidencia({
      rendaTributavelAnual: 120000,
      aporteAnual: 14400,
      aliquotaMarginal: 0.275,
      taxaRetorno: 0.08,
      horizonYears: 12,
    });
    expect(r.diff).toBeGreaterThan(0);

    expect(screen.getByText("Líquido PGBL")).toBeInTheDocument();
    expect(screen.getByText(formatRs(r.netPgbl))).toBeInTheDocument();
    expect(screen.getByText("Líquido VGBL")).toBeInTheDocument();
    expect(screen.getByText(formatRs(r.netVgbl))).toBeInTheDocument();
    expect(screen.getByText(/PGBL compensa com declaração completa/i)).toBeInTheDocument();
  });

  it("mostra veredito VGBL quando diff ≤ 0 (horizonte curto)", () => {
    // h=2 com defaults (alíquota alta mas prazo curtíssimo) → VGBL vence.
    setScenario(2, 0.08);
    const r = comparePrevidencia({
      rendaTributavelAnual: 120000,
      aporteAnual: 14400,
      aliquotaMarginal: 0.275,
      taxaRetorno: 0.08,
      horizonYears: 2,
    });
    expect(r.diff).toBeLessThanOrEqual(0);

    render(<PrevidenciaCard />);
    expect(screen.getByText(/VGBL tende a compensar/i)).toBeInTheDocument();
  });
});
