# Aba Imóvel — Design (Fase 4)

**Data:** 2026-05-02
**Status:** Aprovado pelo usuário (decisões A/B/C/D registradas em conversa)
**Fase do projeto:** Fase 4 / aba 2 de 7 (após Renda Fixa)

---

## Objetivo

Substituir o placeholder de `app/imovel/page.tsx` por uma aba de análise read-only do imóvel configurado no cenário global. A aba consome `scenario.realEstate` (Zustand) e o resultado de `/api/simulate` (já consumido pela Visão Geral) para mostrar KPIs, decomposição de custos, financiamento, custos não-recorrentes, riscos e curva de evolução.

Inclui adição complementar ao Drawer global: nova `FinancingSection` para configurar parâmetros do financiamento (hoje o Drawer só tem campos do imóvel à vista).

## Decisões de design

1. **Papel da aba**: read-only. Toda edição vive no Drawer. (Decisão A da pergunta 1.)
2. **Escopo**: 6 blocos — KPIs + decomposição de custos + waterfall receita×custos + financiamento + custos não-recorrentes + riscos críticos + curva de evolução. (Decisão "tudo" da pergunta 2.)
3. **Financiamento**: adicionar `FinancingSection` ao Drawer com toggle on/off. (Decisão A da pergunta 3.)
4. **Custos não-recorrentes**: tabela calculada (ITBI = `acquisitionCostPct × propertyValue`; caução = `monthlyRent × 3`). Reformas e mobília saem como nota de rodapé. (Decisão B da pergunta 4.)
5. **Fonte dos dados**: KPIs e decomposição via `lib/imovel-derive.ts` (puro, client-side). Curva de evolução vem de `/api/simulate` (hook `useScenarioSimulation` reaproveitado). (Decisão C da pergunta 5.)

## Arquitetura

### Estrutura de arquivos

```
web/app/imovel/page.tsx                                              # rota (server)
web/components/imovel/
  ImovelPageContent.tsx                                              # client wrapper
  KpiRowImovel.tsx                                                   # bloco KPI (4 cards)
  CostBreakdownCard.tsx                                              # bloco 1
  IncomeVsCostsCard.tsx                                              # bloco 2 (waterfall)
  FinancingCard.tsx                                                  # bloco 3 (condicional)
  AcquisitionCostsCard.tsx                                           # bloco 4
  RisksCard.tsx                                                      # bloco 5
  EvolutionCard.tsx                                                  # bloco 6 (linha)
web/lib/imovel-derive.ts                                             # fórmulas puras + REAL_ESTATE_RISKS
web/components/scenario-drawer/sections/FinancingSection.tsx         # NEW
```

Sem store próprio. `scenario.realEstate` (em `useScenarioStore`) é a fonte canônica.

### Data flow

```
ImovelPageContent
├── useScenarioStore() → scenario.realEstate          (síncrono)
├── useScenarioSimulation() → /api/simulate           (assíncrono, com fallback de loading/erro)
│   └── SimulationResultOut.realEstate
│       ├── years, patrimony
│       ├── debtBalance (financiado)
│       └── internalPortfolio (financiado)
└── lib/imovel-derive.ts (puro, sem rede)
    ├── grossYield, netYield, totalCosts, ...
    ├── costBreakdown, incomeWaterfall, financingSummary
    └── acquisitionCosts, REAL_ESTATE_RISKS
```

Cards consomem só os dados que precisam — não lêem store diretamente.

## Componentes — interfaces

```ts
// KpiRowImovel.tsx
type Props = { re: RealEstateInput };
// 4 KpiCards: Yield Bruto, Yield Líquido, Receita Líquida Anual, Custo Total Anual
// Última card: delta inverso "X% da receita"

// CostBreakdownCard.tsx
type Props = { re: RealEstateInput };
// Barras horizontais % com legenda (pattern do ByIndexerCard da Renda Fixa)
// 6 itens: IPTU, Vacância, Manutenção, Adm. Imobiliária, Seguro, IR sobre Aluguel

// IncomeVsCostsCard.tsx
type Props = { re: RealEstateInput };
// Mini-waterfall em SVG inline: 5 barras
// [Aluguel bruto] [−Vacância] [−Custos op.] [−IR] [=Líquido]

// FinancingCard.tsx
type Props = { re: RealEstateInput; simulation: SimulationResultOut };
// Se re.financing == null → return null
// KPIs: Entrada, Parcela inicial, Total juros, Prazo (todos via financingSummary(re),
//       em closed-form — não dependem de simulation)
// LineChart de simulation.debtBalance (saldo devedor ano a ano — vem do backend)
// Banner amarelo se simulation.internalPortfolio.min() < 0

// AcquisitionCostsCard.tsx
type Props = { re: RealEstateInput };
// Tabela 2 linhas: ITBI + cartório, Caução (3× aluguel)
// Rodapé: "Reformas/mobília (R$ 5k–35k) ficam fora desta análise"

// RisksCard.tsx
type Props = {};  // sem props — lê constante REAL_ESTATE_RISKS
// Lista de 6 riscos com title destacado + body curto

// EvolutionCard.tsx
type Props = { simulation: SimulationResultOut };
// LineChart com até 3 séries:
//  - patrimony (verde brand) — sempre
//  - debtBalance (vermelho) — só se financiado
//  - internalPortfolio (azul) — só se financiado
```

### Layout (`ImovelPageContent.tsx`)

```
┌───────────────────────────────────────────────┐
│  KpiRowImovel                                 │
├──────────────────────┬────────────────────────┤
│  CostBreakdownCard   │  IncomeVsCostsCard     │
├──────────────────────┴────────────────────────┤
│  FinancingCard (full width, condicional)      │
├──────────────────────┬────────────────────────┤
│  EvolutionCard       │  AcquisitionCostsCard  │
│                      │  RisksCard             │
└──────────────────────┴────────────────────────┘
```

Estados: `<KpiSkeleton />` enquanto `useScenarioSimulation` carrega; `<ErrorBanner />` em caso de erro do `/api/simulate`. Sem `financing` → `FinancingCard` não monta, layout reflui.

## `lib/imovel-derive.ts` — API

Funções puras espelhando `RealEstateParams` do engine Python (`api/core/config.py`).

```ts
// KPIs
grossAnnualRent(re: RealEstateInput): number             // monthlyRent * 12
annualIptu(re): number                                   // propertyValue * iptuRate
vacancyLoss(re): number                                  // monthlyRent * vacancyMonthsPerYear
managementFee(re): number                                // grossAnnualRent * managementFeePct
incomeTaxAmount(re): number                              // (grossRent - vacancyLoss) * incomeTaxBracket
totalCosts(re): number                                   // soma de IPTU + vacância + manutenção + adm + seguro + IR
netAnnualIncome(re): number                              // grossRent - totalCosts
grossYield(re): number                                   // grossRent / propertyValue
netYield(re): number                                     // netAnnualIncome / propertyValue

// Decomposição (bloco 1)
costBreakdown(re): Array<{ label: string; value: number; color: string }>
// 6 entradas com cores: IPTU (#FFC857), Vacância (#FF6B5B), Manutenção (#5CC8FF),
//                       Adm. Imobiliária (#46E8A4), Seguro (#7D9591), IR (#FF5D72)

// Waterfall (bloco 2)
incomeWaterfall(re): Array<{ label: string; value: number; type: "start"|"deduction"|"end" }>
// [{ "Aluguel bruto", grossAnnualRent, "start" },
//  { "Vacância",      -vacancyLoss,    "deduction" },
//  { "Custos op.",    -(iptu+manut+adm+seguro), "deduction" },
//  { "IR aluguel",    -incomeTax,      "deduction" },
//  { "Receita líquida", netAnnualIncome, "end" }]

// Financing (bloco 3) — todas as fórmulas client-side em closed-form,
// sem precisar do schedule completo do backend
financingSummary(re): {
  entry: number;            // propertyValue * entryPct
  loanPrincipal: number;    // propertyValue - entry
  termYears: number;
  systemLabel: "SAC" | "Price";
  firstPayment: number;     // ver fórmulas abaixo
  totalInterest: number;    // ver fórmulas abaixo
} | null                    // null se re.financing == null

// Fórmulas (n = termYears * 12, i = (1 + annualRate)^(1/12) - 1, P = loanPrincipal):
//   SAC  : firstPayment = P/n + P*i
//          totalInterest = P*i*(n+1)/2     (soma da PA dos juros)
//   Price: PMT = P * (i*(1+i)^n) / ((1+i)^n - 1)
//          firstPayment = PMT
//          totalInterest = PMT*n - P
// Seguro mensal NÃO entra nessas KPIs (é cobrado em cima do saldo, varia mês a mês —
// o backend já contabiliza no fluxo de caixa, mas não expomos como KPI separado aqui)

// Custos não-recorrentes (bloco 4)
acquisitionCosts(re): Array<{ item: string; value: number }>
// [{ "ITBI + cartório", propertyValue * acquisitionCostPct },
//  { "Caução (3× aluguel)", monthlyRent * 3 }]

// Riscos (bloco 5)
export const REAL_ESTATE_RISKS: Array<{ title: string; body: string }>
// 6 itens hardcoded, sem dependência de scenario:
// 1. Concentração — 1 ativo = 100% do capital
// 2. Iliquidez — 3-12 meses para venda
// 3. Inadimplência — 1-2 meses comuns mesmo com fiança
// 4. Vacância prolongada — paralisa receita
// 5. Risco regulatório — lei do inquilinato favorece locatário
// 6. Depreciação — reformas estruturais a cada 7-10 anos
```

## `FinancingSection.tsx` — adição ao Drawer

Nova seção que entra no `ScenarioDrawer.tsx` logo após `RealEstateSection`.

```tsx
const FINANCING_INPUTS = [
  { name: "termYears",            label: "Prazo (anos)",                step: "1" },
  { name: "annualRate",           label: "Taxa anual",                  step: "0.005", hint: "0,115 = 11,5%" },
  { name: "entryPct",             label: "Entrada",                     step: "0.05",  hint: "0,20 = 20%" },
  { name: "monthlyInsuranceRate", label: "Seguro mensal sobre saldo",   step: "0.0001", hint: "0,0005 = 0,05%/mês" },
];

// Toggle on/off:
// - off → setValue("realEstate.financing", null)
// - on  → setValue("realEstate.financing", DEFAULT_FINANCING)
//
// Select adicional para system: "SAC" | "Price"
```

`DEFAULT_FINANCING` em `lib/defaults.ts`:
```ts
export const DEFAULT_FINANCING: FinancingInput = {
  termYears: 30,
  annualRate: 0.115,
  entryPct: 0.20,
  system: "SAC",
  monthlyInsuranceRate: 0.0005,
};
```

## Schema do Drawer

`web/components/scenario-drawer/schema.ts` deve aceitar `realEstate.financing` como `FinancingInput | null`. Se ainda não permitir, atualizar (espera-se que o tipo já exista — confirmar antes da implementação).

## Compatibilidade de localStorage

A chave `investa-scenario-v2` (já vigente desde a fase MC) acomoda o campo opcional `financing`. Estados salvos com `financing: null` continuam válidos — toggle abre desligado. Não é necessário bumpar a versão.

## Testes

3 arquivos novos:

### `web/tests/imovel-derive.test.ts`
Cobre todas as funções de `lib/imovel-derive.ts` com fixture `DEFAULT_SCENARIO.realEstate`. Asserções comparam contra valores derivados manualmente.

Cenários:
- Cash (`financing: null`) → `financingSummary` retorna null
- Financiado (`financing: DEFAULT_FINANCING`) → `entry = 46_000`, `loanPrincipal = 184_000`,
  `firstPayment` e `totalInterest` batem com fórmulas SAC closed-form (com tolerância de ±R$ 1)
- Vacância 0 → `vacancyLoss = 0` e composição reflete
- IR isento (`incomeTaxBracket = 0`) → `incomeTaxAmount = 0`
- `totalCosts >= 0` para qualquer entrada válida (sanity)
- `grossYield ~ 0.0783` e `netYield ~ 0.0415` para defaults

### `web/tests/imovel-page.test.tsx`
Smoke test do `ImovelPageContent` com mock de `useScenarioSimulation`.

Cenários:
- Renderiza KPIs com defaults
- `financing: null` → `FinancingCard` não está no DOM
- `financing: DEFAULT_FINANCING` → `FinancingCard` no DOM, LineChart de saldo devedor monta
- Loading → `<KpiSkeleton />` aparece
- Erro do hook → `<ErrorBanner />` aparece

### `web/tests/financing-section.test.tsx`
Comportamento do toggle e bind ao form do Drawer.

Cenários:
- Toggle desligado → campos não aparecem; `realEstate.financing` no form é `null`
- Toggle ligado → 5 campos visíveis; valores dos defaults
- Toggle off→on→off → estado volta a `null` sem vazar valores

Total: ~25-30 testes em 3 arquivos.

## Critérios de aceite

Smoke manual em produção (Vercel + Render):

1. Sidebar → Imóvel mostra a aba populada com defaults (R$ 230k, R$ 1.5k aluguel)
2. KPIs: Yield Bruto ~7,8%, Yield Líquido ~4,2%, Receita Líquida ~R$ 9.6k, Custo Total ~R$ 8.4k
3. CostBreakdownCard mostra 6 itens com valores que somam ao Custo Total
4. IncomeVsCostsCard mostra 5 barras (waterfall mini)
5. AcquisitionCostsCard: ITBI = R$ 11.500 (5%×230k), Caução = R$ 4.500 (3×1.5k)
6. RisksCard mostra 6 bullets
7. EvolutionCard renderiza linha do patrimônio ao longo do horizonte
8. **Drawer → toggle "Financiar imóvel?" para ON**:
   - 5 campos novos aparecem com defaults (30a, 11,5%, 20%, SAC, 0,05%)
   - Salvar fecha drawer; FinancingCard aparece na aba Imóvel
   - Parcela inicial ~R$ 2.250 (SAC, 30a, 11,5%, principal R$ 184k)
   - LineChart de saldo devedor decresce monotonicamente até zero no ano 30
   - Banner amarelo aparece se carteira interna negativa
9. Sem erros no console em nenhum cenário

## Trabalho fora de escopo (FUTURE_IMPROVEMENTS)

- Edição inline na própria aba Imóvel (espelho do Drawer) — registrado em conversa para fase futura
- Múltiplos imóveis (engine e modelo são single-property hoje)
- Reformas/mobília como inputs editáveis em vez de notas de rodapé
- Importação de cenários imobiliários por CSV (analogia com Renda Fixa)
- Comparação de cenários financiados vs à vista lado-a-lado
