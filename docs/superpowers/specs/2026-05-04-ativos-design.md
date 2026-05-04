# Aba Ativos — Design

**Data:** 2026-05-04
**Status:** Aprovado pelo usuário (decisões C/A/A/B + Z + B+D registradas em conversa)
**Fase do projeto:** Pós-Fase 4 / Feature de adição de ativos individuais

---

## Objetivo

Criar uma nova aba "Ativos" para o usuário registrar posições reais de ações, FIIs, ETFs (BR e US), Stocks, REITs (US). Cada posição tem ticker, classe, quantidade, preço médio, yield esperado, ganho de capital esperado. A aba mostra KPIs blended, agregação por classe e por mercado (BR/US), e permite import/export CSV.

A aba é **paralela à Carteira** — não altera o comparador "Imóvel × Carteira × Tesouro" da Fase 4. No futuro (decisão C), um toggle no Drawer permitirá usar essas posições reais para alimentar o comparador (substituindo as 5 classes hardcoded).

## Decisões de design

1. **Posições individuais (B) + CSV import (D)** — escolha do usuário em pré-brainstorm.
2. **Manual prices (Z)** — sem cotação online; valor presente = `quantity × avgPrice`. Cotação online é polish para fase posterior.
3. **C — paralela com toggle futuro** — aba independente; integração com Carteira via Drawer toggle entra como FUTURE_IMPROVEMENTS.
4. **A — 9 classes** (BR=6 + US=3): FII Papel, FII Tijolo, Ação BR Dividendo, Ação BR Crescimento, ETF BR, BDR, Stock US, REIT US, ETF US.
5. **A — agregação em BRL** usando `macro.usdBrl` do BCB live; sem dual currency display.
6. **B — 8 campos por posição** (id, ticker, assetClass, currency, quantity, avgPrice, expectedYield, capitalGain) + color runtime.

## Arquitetura

### Estrutura de arquivos

```
web/app/ativos/page.tsx                                       # rota (server)
web/components/ativos/
  AtivosPageContent.tsx                                       # client wrapper (orchestrator)
  AssetsTable.tsx                                             # tabela CRUD com bullet por classe
  AssetDialog.tsx                                             # modal Add/Edit/Delete (react-hook-form)
  KpiRowAtivos.tsx                                            # 4 KPIs do topo
  ByAssetClassCard.tsx                                        # alocação por classe (barras)
  ByMarketCard.tsx                                            # BR vs US (barras + cotação USD/BRL)
web/lib/ativos-schema.ts                                      # zod schema + AssetClass enum + ASSET_CLASS_META
web/lib/ativos-store.ts                                       # Zustand persist "investa-assets-v1"
web/lib/ativos-derive.ts                                      # ativosKpis + byAssetClass + byMarket + positionValueBRL
web/lib/ativos-csv.ts                                         # papaparse import/export (BR-friendly)
web/lib/nav.ts                                                # adicionar entrada "Ativos" entre Carteira e Sensibilidade
```

Sem alterações no backend Python — feature é puramente frontend.

### Data flow

```
AtivosPageContent
├── useAssetsStore (Zustand persist) → positions
│     └── skipHydration: true; rehydrate manual em useEffect
├── useMacro() → { usdBrl, ... }                       (TanStack — cache compartilhado)
└── lib/ativos-derive.ts (puro)
    ├── positionValueBRL(p, macro) → number
    ├── ativosKpis(positions, macro) → { totalAllocated, blendedYield, blendedCapitalGain, totalReturn }
    ├── byAssetClass(positions, macro) → AssetClassGroup[] sorted desc
    └── byMarket(positions, macro) → { br, us }
```

Storage local independente; não passa por backend. Hidratação manual evita flash de empty state.

### Layout

```
┌──────────────────────────────────────────────────┐
│  KpiRowAtivos (4 cards)                          │
├──────────────────────────────────────────────────┤
│  AssetsTable                                     │
│  - botões: Importar CSV / Exportar CSV / + Adicionar │
│  - colunas: Ticker · Classe · Moeda · Qty · Preço · Valor (BRL) · DY · Ações │
│  - empty state com CTA "Adicione a primeira"     │
├──────────────────────┬───────────────────────────┤
│  ByAssetClassCard    │  ByMarketCard             │
│  (até 9 grupos)      │  (BR vs US + USD/BRL)     │
└──────────────────────┴───────────────────────────┘
```

Estados: `<KpiSkeleton />` antes da hidratação Zustand ou enquanto macro carrega; `<ErrorCard />` em erro do macro.

## `lib/ativos-schema.ts` — types + zod + metadata

```ts
import { z } from "zod";

export const assetClassSchema = z.enum([
  "FII_PAPEL", "FII_TIJOLO",
  "ACAO_BR_DIVIDENDO", "ACAO_BR_CRESCIMENTO",
  "ETF_BR", "BDR",
  "STOCK_US", "REIT_US", "ETF_US",
]);
export type AssetClass = z.infer<typeof assetClassSchema>;

export const currencySchema = z.enum(["BRL", "USD"]);
export type Currency = z.infer<typeof currencySchema>;

const colorRegex = /^#[0-9A-Fa-f]{6}$/;

export const assetPositionSchema = z.object({
  id: z.string().min(1),
  ticker: z.string().min(1).max(12).regex(/^[A-Za-z0-9.]+$/, "ticker: letras/números/ponto"),
  assetClass: assetClassSchema,
  currency: currencySchema,
  quantity: z.number().positive(),
  avgPrice: z.number().positive(),
  expectedYield: z.number().min(0).max(1),
  capitalGain: z.number().min(-1).max(1),
  color: z.string().regex(colorRegex),
});

export type AssetPosition = z.infer<typeof assetPositionSchema>;

type AssetClassMeta = {
  label: string;
  market: "BR" | "US";
  defaultCurrency: Currency;
  taxRate: number;
  taxNote: string;
  color: string;
  defaultYield: number;
  defaultCapitalGain: number;
};

export const ASSET_CLASS_META: Record<AssetClass, AssetClassMeta> = {
  FII_PAPEL:           { label: "FII de Papel",            market: "BR", defaultCurrency: "BRL", taxRate: 0,    taxNote: "Rendimentos isentos PF",                              color: "#FFC857", defaultYield: 0.13, defaultCapitalGain: 0    },
  FII_TIJOLO:          { label: "FII de Tijolo",           market: "BR", defaultCurrency: "BRL", taxRate: 0,    taxNote: "Rendimentos isentos PF",                              color: "#FF6B5B", defaultYield: 0.09, defaultCapitalGain: 0.02 },
  ACAO_BR_DIVIDENDO:   { label: "Ação BR (dividendo)",     market: "BR", defaultCurrency: "BRL", taxRate: 0,    taxNote: "Dividendos isentos até R$ 50k/mês por empresa",       color: "#5CC8FF", defaultYield: 0.08, defaultCapitalGain: 0.03 },
  ACAO_BR_CRESCIMENTO: { label: "Ação BR (crescimento)",   market: "BR", defaultCurrency: "BRL", taxRate: 0,    taxNote: "Dividendos isentos até R$ 50k/mês",                   color: "#46E8A4", defaultYield: 0.02, defaultCapitalGain: 0.10 },
  ETF_BR:              { label: "ETF BR",                  market: "BR", defaultCurrency: "BRL", taxRate: 0.15, taxNote: "15% sobre ganho de capital",                          color: "#C39BD3", defaultYield: 0,    defaultCapitalGain: 0.10 },
  BDR:                 { label: "BDR",                     market: "BR", defaultCurrency: "BRL", taxRate: 0.15, taxNote: "15% sobre ganho; dividendos têm IR retido na origem", color: "#FFB088", defaultYield: 0.02, defaultCapitalGain: 0.08 },
  STOCK_US:            { label: "Stock US",                market: "US", defaultCurrency: "USD", taxRate: 0.30, taxNote: "30% retido em dividendos (tratado pode reduzir)",     color: "#7DCFFF", defaultYield: 0.04, defaultCapitalGain: 0.06 },
  REIT_US:             { label: "REIT US",                 market: "US", defaultCurrency: "USD", taxRate: 0.30, taxNote: "30% retido em dividendos",                            color: "#A2E5C0", defaultYield: 0.05, defaultCapitalGain: 0.03 },
  ETF_US:              { label: "ETF US",                  market: "US", defaultCurrency: "USD", taxRate: 0.30, taxNote: "30% retido em dividendos",                            color: "#F8C471", defaultYield: 0.02, defaultCapitalGain: 0.07 },
};
```

## `lib/ativos-derive.ts` — API

```ts
export function positionValueBRL(p: AssetPosition, macro: MacroOut): number;

export type AtivosKpis = {
  totalAllocated: number;
  blendedYield: number;
  blendedCapitalGain: number;
  totalReturn: number;
};
export function ativosKpis(positions: AssetPosition[], macro: MacroOut): AtivosKpis;

export type AssetClassGroup = {
  assetClass: AssetClass;
  label: string;
  color: string;
  positions: number;
  totalBRL: number;
  weight: number;
};
export function byAssetClass(positions: AssetPosition[], macro: MacroOut): AssetClassGroup[];

export type MarketSplit = {
  br: { totalBRL: number; weight: number; positions: number };
  us: { totalBRL: number; weight: number; positions: number };
};
export function byMarket(positions: AssetPosition[], macro: MacroOut): MarketSplit;
```

Implementação completa (com fórmulas de blendedYield/capGain/conversão USD→BRL) está nas seções da brainstorm — replicar verbatim no plano de implementação.

## `lib/ativos-store.ts`

Zustand persist com chave `investa-assets-v1`, `skipHydration: true`. Cópia 1:1 do pattern `fi-store.ts`. Operações: `upsertPosition`, `removePosition`, `replaceAllPositions`. Cor atribuída automaticamente do PALETTE de 8 cores na inserção.

## `lib/ativos-csv.ts`

papaparse import/export. CSV BR-friendly: BOM utf-8-sig, `;` separador, `,` decimal.

Colunas (header pt-BR):
```
Ticker;Classe;Moeda;Quantidade;Preço Médio;Yield Esperado;Ganho Capital
```

`importCsv(file) → { positions, errors[] }`:
- Não lança; coleta erros por row via zod safeParse
- Mapeia label "FII Papel" → enum `FII_PAPEL` (e equivalentes)
- Linha com classe inválida vai pra `errors[]` com `{ row, field, message }`
- Cabeçalho ausente → erro fatal único

`exportCsv(positions) → string`:
- Mesmo formato, com `toFixed(2)` para preços e `toFixed(4)` para yields/cap gain (precisão razoável sem cauda de float).

## Componentes — interfaces

### `AssetDialog.tsx`
```ts
type Props = {
  open: boolean;
  mode: "add" | "edit";
  initial?: AssetPosition;
  onClose: () => void;
  onSubmit: (p: Omit<AssetPosition, "color">) => void;
  onDelete?: (id: string) => void;
};
```
Modal react-hook-form + zod resolver. 7 campos (Ticker · Classe · Moeda · Qty · Preço · Yield · CapGain). Mudar Classe ajusta defaults de Moeda/Yield/CapGain via watch + setValue. Yield/CapGain digitados como percent (5 = 5%) e convertidos para decimal no submit. Pattern: `PositionDialog` da Renda Fixa.

### `AssetsTable.tsx`
```ts
type Props = {
  positions: AssetPosition[];
  macro: MacroOut;
  onAdd: () => void;
  onEdit: (p: AssetPosition) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
  onExport: () => void;
};
```
Header com 3 botões + tabela 8 colunas (Ticker bullet · Classe label · Moeda · Qty · Preço Médio · Valor BRL · DY · ✏️🗑️). Empty state com CTA. Click na linha → onEdit.

### `KpiRowAtivos.tsx`
```ts
type Props = { kpis: AtivosKpis };
```
4 KpiCards: Total alocado · DY blended líq. · Ganho capital esp. · Retorno total a.a. (feature, green).

### `ByAssetClassCard.tsx`
```ts
type Props = { groups: AssetClassGroup[] };
```
Lista barras horizontais (até 9 entradas) com bullet + label + weight + totalBRL. Empty state.

### `ByMarketCard.tsx`
```ts
type Props = { split: MarketSplit; macro: MacroOut };
```
2 linhas (BR/US) com bullet, contagem, weight, totalBRL. Header mostra "USD/BRL = X,XX · BCB live".

### `AtivosPageContent.tsx`
Orchestrator com hidratação manual do Zustand (`useEffect → useAssetsStore.persist.rehydrate()`), file input oculto pra import CSV, dialog state local, useMacro para conversão.

## Adicionar entrada no nav

`web/lib/nav.ts` — adicionar:
```ts
{ href: "/ativos", label: "Ativos", icon: "Briefcase" }
```
Entre `/carteira` e `/sensibilidade`.

## Testes

5 arquivos novos:

### `web/tests/ativos-derive.test.ts` (~10 testes)
Fixture: 4 posições mistas. Casos: positionValueBRL conversão; ativosKpis array vazio; blendedYield com taxRate=0 e taxRate=0.30; blendedCapitalGain ponderado; totalReturn soma; byAssetClass agrupa e ordena; weight soma 1; byMarket BR/US split; byMarket vazio.

### `web/tests/ativos-store.test.ts` (~3)
upsertPosition (add+edit) com color do PALETTE; removePosition.

### `web/tests/ativos-csv.test.ts` (~6)
exportCsv BOM + header pt-BR + 9 colunas; round-trip importCsv→exportCsv; classe inválida; quantidade negativa; arquivo vazio; cabeçalho ausente.

### `web/tests/asset-dialog.test.tsx` (~5)
Open add → defaults FII Papel; mudar Classe pra Stock US ajusta moeda+yield+capGain; submit válido yields decimal; ticker vazio → erro; mode edit populated + botão Excluir.

### `web/tests/ativos-page.test.tsx` (~5)
Empty state; renderiza 4 KPIs + tabela + 2 cards; loading skeleton; macro error → ErrorCard; click Adicionar abre dialog.

Total: ~29 testes em 5 arquivos.

## Critérios de aceite (smoke produção)

1. Sidebar → Ativos → empty state com CTA
2. Click "Adicionar" → modal abre, defaults FII Papel
3. Submit válido (ITSA4 / Ação BR Div / 100 / R$ 10 / 8% / 3%) → tabela mostra 1 linha
4. KPIs: Total **R$ 1.000**, DY blended **8,00%** (taxRate=0)
5. Adicionar JNJ / Stock US / 10 / US$ 150 / 3,2% / 5% → Total = R$ 1.000 + (10 × 150 × 5,30) ≈ **R$ 8.950**
6. Por Classe: 2 grupos ordenados por valor
7. Por Mercado: BR ~11%, US ~89%
8. Exportar CSV → arquivo BOM utf-8-sig, decimais com vírgula
9. Importar CSV → idempotente
10. F5 → posições persistem (Zustand)
11. Editar JNJ via clique na linha → modal populated; alterar qty; recálculo automático

## Trabalho fora de escopo (FUTURE_IMPROVEMENTS)

- **Toggle de integração com Carteira**: Drawer ganha switch "usar meus ativos no comparador". Quando ON, agrega posições em classes e injeta em `scenario.portfolio.assets`, substituindo defaults. Default OFF.
- **Cotação online** (Alpha Vantage / Brapi / Yahoo): valor presente real, não mais avgPrice. Entra junto com Open Finance (direção 4 do roadmap).
- **Override de USD/BRL**: usuário pode digitar a cotação no Drawer pra simular cenários de câmbio.
- **Sub-classes**: FII Híbrido, Small Caps BR, Bond ETF US — só se demanda real surgir (hoje cobrem 95% dos casos).
- **Cripto**: explicitamente excluído (tributação distinta + cotação 24/7 + complexidade contábil).
- **Histórico de aportes**: hoje cada posição tem 1 avgPrice (custo médio). No futuro, registrar lotes individuais (compra de 50@10, depois 50@12) para cálculo correto de IR ao vender.
- **Performance vs benchmark**: gráfico comparando carteira de ativos com IBOV/CDI/SP500.
