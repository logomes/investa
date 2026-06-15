export type PrevidenciaInputs = {
  rendaTributavelAnual: number;
  aporteAnual: number; // capped at 12% da renda for the deduction
  aliquotaMarginal: number; // 0.075 | 0.15 | 0.225 | 0.275
  taxaRetorno: number; // a.a. (decimal)
  horizonYears: number;
};

export type PrevidenciaResult = {
  netPgbl: number;
  netVgbl: number;
  diff: number; // diff = netPgbl − netVgbl
  deductionUsedAnnual: number; // min(aporte, 12% renda)
};

/**
 * Regressiva de previdência por tranche: piso 10%.
 * Tabela longa BR: ≤2a 35%, 2-4a 30%, 4-6a 25%, 6-8a 20%, 8-10a 15%, >10a 10%.
 * Os limites de banda são inclusivos no piso (resgate exatamente em 2 anos
 * ainda é 35%), portanto a faixa avança a cada 2 anos completados, i.e.
 * floor((holdingYears − 1) / 2) — casa com a tabela pinada nos testes.
 */
export function previdenciaRate(holdingYears: number): number {
  // Banded in whole percentage points; round to kill FP drift (0.35 − 0.05·2
  // = 0.24999…) so the rates land exactly on 0.35/0.30/0.25/0.20/0.15/0.10.
  const raw = 0.35 - 0.05 * Math.floor((holdingYears - 1) / 2);
  return Math.max(Math.round(raw * 100) / 100, 0.1);
}

export function comparePrevidencia(i: PrevidenciaInputs): PrevidenciaResult {
  const { aporteAnual, aliquotaMarginal, taxaRetorno, horizonYears } = i;

  const deductionUsedAnnual = Math.min(aporteAnual, 0.12 * i.rendaTributavelAnual);
  // PGBL reinveste a restituição (deduction × alíquota marginal) no próprio plano.
  const contribPgbl = aporteAnual + deductionUsedAnnual * aliquotaMarginal;

  let netPgbl = 0;
  let netVgbl = 0;

  // Aportes no begin-of-year t = 0..h−1; saída em h. A tranche do ano t é
  // mantida (h − t) anos e sai na faixa previdenciaRate(h − t).
  for (let t = 0; t < horizonYears; t++) {
    const holding = horizonYears - t;
    const growth = Math.pow(1 + taxaRetorno, holding);
    const rate = previdenciaRate(holding);

    // PGBL: IR sobre o TOTAL da tranche.
    const valuePgbl = contribPgbl * growth;
    netPgbl += valuePgbl - rate * valuePgbl;

    // VGBL: IR só sobre o GANHO da tranche.
    const valueVgbl = aporteAnual * growth;
    const gainVgbl = valueVgbl - aporteAnual;
    netVgbl += valueVgbl - rate * gainVgbl;
  }

  return {
    netPgbl,
    netVgbl,
    diff: netPgbl - netVgbl,
    deductionUsedAnnual,
  };
}
