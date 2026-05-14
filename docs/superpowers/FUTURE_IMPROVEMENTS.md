# Future Improvements

Items deferred from earlier phases — to be brainstormed/planned when their owning phase comes up.

## Charts

### Monthly resolution for "1A" filter on Evolution chart — ✅ shipped 2026-05-09 (frontend interpolation)

`EvolutionCard` now renders 13 M0–M12 labels on the 1A range, computed via geometric interpolation between Y0 and Y1 (linear fallback when an endpoint is non-positive). MC bands stay annual-only and are hidden on the monthly view.

**Trade-off vs full backend:** small drift (~1-2%) in real-estate Y1 mid-points because financing schedule (SAC/Price month-by-month) is not modeled — portfolio and benchmark match exactly since they're geometric. If precision becomes important, a `POST /api/simulate/monthly` endpoint can replace the front-side interpolation without touching the consumer code.

## Goal Card

### Editable goal target — ✅ shipped 2026-05-09

GoalCard goal value is now click-to-edit: button → input pre-filled with current `goalTarget`, Enter/blur commits via `setGoalTarget`, Esc cancels, invalid input (≤0 or non-numeric) reverts silently. Persists through Zustand and propagates to "Probabilidade de meta" KPI + progress bar.

### Real recommendation engine — ✅ shipped 2026-05-13

GoalCard agora roda um recomendador real. Sugestão de aporte vem de FV closed-form (`web/lib/goal-recommend.ts`), badge "% provável" agora reflete probabilidade real do Monte Carlo `finalDistribution` (antes era `current/goal` mal-rotulado), e "Aplicar sugestão" muta `scenario.portfolio.monthlyContribution` no store. State machine de 4 estados: already-met / already-on-track / below / unreachable. Spec: `specs/2026-05-13-goal-recommender-design.md`.

**Follow-up futuro:** busca binária sobre Monte Carlo pra resolver "aporte que hit P(meta) ≥ X%" — fica deferido até alguém querer o ajuste fino.

## Ativos

### B3 import — ✅ shipped 2026-05-09

`/ativos` "Importar B3" aceita 4 tipos de export do portal Investidor B3 (CSV ou XLSX): **Posição** (Minha Carteira → Investimentos), **Movimentação**, **Negociação** e **Eventos** (Extratos → ...). Posição agrega quantidades entre brokers e classifica via sheet name + Tipo. Negociação é a fonte preferida pra preço médio (cleaner que Movimentação) e normaliza o suffix `F` do Mercado Fracionário (BBDC3F → BBDC3). Eventos popula um banner "Renda agendada" persistente acima da tabela com total de proventos futuros + número de pagamentos + ticker count + range de datas.

**Deferido:** Tesouro Direto (aba separada do portal, formato distinto), eventos corporativos quantitativos (split/inplit/bonificação — aparecem em Movimentação como `Bonificação em Ativos`/`Desdobro` mas o user não tem amostra ainda), integração com Pluggy/Belvo aggregators pra atualização contínua sem upload manual.

### Snapshot mensal de patrimônio — ✅ shipped 2026-05-11

`/historico` permite capturar manualmente o PL marcado a mercado (RV + RF). RV usa `currentPrice ?? avgPrice`; RF compõe `initialAmount × (1 + effectiveAnnualRate)^years`. Snapshot persiste em store separado (`investa-patrimony-snapshots-v1`) e popula 3 KPIs + line chart SVG + tabela com delete. Replace-by-date evita duplicatas no mesmo dia. Base para TWR / drawdown / curva aporte-vs-valorização futuros.

### Dashboard de Proventos — ✅ shipped 2026-05-11

`/proventos` agrega histórico de Rendimento/Dividendo/JCP pagos (extraídos automaticamente da Movimentação) com agendados futuros (Eventos). KPIs: recebido 12m, agendado futuro, DY realizado vs esperado ponderado, próximo pagamento. Bar chart 24m passados + 3m futuros (futuros em opacity baixa). Tabela por ativo com DY realizado vs esperado e gap colorido. Trades duplicados são deduplicados via key `date|ticker|type|netValue`.

### Auto-fetch current quote (`currentPrice` + `asOf`) on add/edit — ✅ shipped 2026-05-09

**Shipped scope:** `GET /api/quotes?ticker=&market=` with provider chain (BR: BRAPI → Yahoo `.SA`; US: Yahoo → Stooq), 60s server cache, 3s per-provider timeout, no API keys. Frontend `AssetDialog` fetches on ticker blur. `AssetsTable` shows a "Preço atual" column with currentPrice converted to BRL (US assets use `macro.usdBrl`), native USD as subtext, relative `asOf`, and per-row refresh button.

## Open Finance

### Open Finance Brasil — sync automatizado de carteira

**Phase target:** Future — gated em decisão personal-tool vs SaaS

Open Finance Brasil é o padrão regulado pelo Bacen pra compartilhamento de dados financeiros via APIs. Fase 4 (ativa desde 2022) cobre **investimentos**: posições e movimentações em renda fixa, renda variável, fundos, previdência, COE. Substitui o upload manual de XLSX por sync automatizado direto dos brokers.

**Caminhos:**

| Opção | Custo | Esforço | Notas |
|---|---|---|---|
| **Pluggy aggregator** (recomendado) | Free dev (sandbox); ~R$ 12-50/mês prod por # brokers | ~6-8h | SDK React (`react-pluggy-connect`), docs em PT, melhor tração BR |
| Belvo | Free dev; pago prod | ~6-8h | Foco LATAM/ES, menos market BR |
| Klavi | Pago do início | ~6-8h | OF Brasil certified, menos tração |
| Direct OF via Bacen | Free per-call | Multi-meses | Requer registro Bacen, ICP-Brasil, SOC2/ISO27001 — fora de escopo |
| Status quo (XLSX manual) | Zero | Já shipped | Caminho atual via "Importar B3" |

**Prerequisites que faltam hoje:**
- Secret management — investa não tem nenhum env var de secret hoje. Adicionar `PLUGGY_CLIENT_ID` + `PLUGGY_CLIENT_SECRET` via Render dashboard (não via render.yaml, pra não commitar).
- (Opcional para SaaS) backend persistence + auth — hoje tudo é localStorage single-user. Manter assim no caminho personal-tool, evoluir só se virar SaaS.

**Implementation outline (quando aprovado):**
- **Backend:** `api/core/data_sources/pluggy.py` (HTTP client seguindo padrão de `bcb.py`) + `api/routers/pluggy.py` com `POST /api/pluggy/connect-token` (token efêmero pro widget) e `POST /api/pluggy/sync` (recebe `itemId`, retorna posições em shape compatível com `AssetPosition`).
- **Frontend:** `react-pluggy-connect` widget + botão "Conectar OpenFinance" em `/ativos`. Callback do widget chama `/api/pluggy/sync` e usa o mesmo merge-by-ticker do `handleB3Import` (em `AtivosPageContent.tsx`).
- **Reuse:** `inferAssetClass` (`web/lib/ativos-classify.ts`) pra mapear categorias Pluggy → AssetClass; `cachetools.TTLCache` pra cachear positions 5min server-side; padrão do `core/data_sources/bcb.py` pra HTTP client com erro tipado.

**Out of scope até pedido explícito:**
- Webhook recorrente (Pluggy notifica push) — polling on-demand basta pra personal tool
- Multi-user / NextAuth / Postgres — sobe junto se virar SaaS
- Histórico de transações (Pluggy `transactions` API) — primeira passada só posições
- Renda fixa (CDB/TD/LCI) — schema Pluggy `FIXED_INCOME` é diferente, combina com refator de `fi-store` em rodada própria
- Disconnect/revoke de conexão — pode vir na rodada 2

**Cost ballpark prod:** R$ 12-50/mês dependendo de quantos brokers o user conecta (Pluggy cobra por conexão ativa).

## Drawer / Form

### Asset list editing UX — ✅ shipped 2026-05-06

PortfolioSection now supports add/edit/remove via modal (PortfolioAssetDialog), 11 type catalog with auto-populated defaults, Σweights badge (green/red), hard validation `Σ=1.0±0.001`, max 12 assets, reset-to-defaults button.

## Performance / Infra

### Render Hobby upgrade ($7/mo)

**Phase target:** Whenever the user wants 10000+ Monte Carlo trajectories live.

Free tier caps at ~2000 trajectories before timing out. Hobby handles 50000+ comfortably with no cold start. The `nTrajectories` slider in the drawer goes up to 50000 already; just bump localStorage value.

### Cloudflare cache for `/api/macro`

**Phase target:** Optional polish

Macro is cached for 1h server-side. Cloudflare CDN cache could absorb burst traffic without hitting Render at all.

## Testing

### Playwright E2E — ✅ shipped 2026-05-09 (smoke + page coverage + CI)

`web/e2e/` covers Visão Geral (4 KPIs + GoalCard click-to-edit), Ativos (auto-classify ticker pattern + current-price column rendering), Carteira (default allocation + 4 KPI labels) and Exportar (long-format table + Baixar CSV download). API responses mocked via shared `e2e/fixtures/api-mocks.ts` so tests don't need the FastAPI backend.

A parallel `e2e` job in `web-ci.yml` runs the full suite on every push/PR with `~/.cache/ms-playwright` cached across runs (keyed by pnpm-lock.yaml) to avoid the ~100MB chromium download on every run.

### API integration tests with TestClient — ✅ shipped 2026-05-09

`api/tests/test_integration.py` covers cross-endpoint invariants the unit tests miss: simulate median falls inside MC p10..p90 band, `/portfolio/defaults` round-trips through `/simulate`, financing scenario produces monotonically-decreasing debtBalance to ~0, seeded MC is byte-identical on repeats, simulate is idempotent for identical payloads, horizon change yields consistent array lengths across both endpoints.

## Mobile

### Responsive layout below 1280px — ✅ shipped 2026-05-09

Sidebar vira off-canvas drawer abaixo de xl (commit `6a533c3`); KPI grids reflow 1→2→4 + page grids stackam + SVG charts com viewBox 100% (`c1007a2`); splash "use desktop" removida, tabelas com overflow-x-auto (`83f7bcf`); Playwright e2e tablet+desktop (`edfa7d5`). Tabelas ficaram como scroll horizontal dentro do card em vez de "card stack" (densidade > formato — escolha de design diferente da spec mas válida).

**Original (preservado para histórico):**

**Phase target:** Future

**Current behavior:** `app/layout.tsx` renders a `desktop-only-warning` block at viewport widths below 1280px:

> **Use desktop ≥1280px**
> O dashboard é desenhado para telas ≥1280px. Mobile vem em uma fase futura.

**Target breakpoints:**
- **Desktop (≥1280px):** current layout, no changes.
- **Tablet (768–1279px):** sidebar collapses to a drawer (toggle in the topbar); main column reflows to a single-column grid for KPIs and charts.
- **Mobile (<768px):** single-column layout end-to-end; KPIs become a horizontal scroll-snap row or stacked cards; tables degrade to a card list per row.

**Required changes by component:**
- **Sidebar (`Sidebar.tsx`):** off-canvas drawer behind a hamburger; trap focus; close on route change. Persists open/closed state in `localStorage`.
- **Topbar (search + "Simular cenário"):** hamburger appears <1280px; search collapses to icon + modal on tap.
- **KPI row (`KpiRow.tsx`):** today is `grid-cols-4`; below 1280px → 2-col, below 768px → horizontal scroll-snap with snap-mandatory.
- **Charts (Evolution / Renda mensal / Comparativo):** Recharts needs `ResponsiveContainer` audited; X-axis labels rotate; legends wrap; touch tooltips (longpress) instead of hover.
- **Tables (`Comparativo`, `Exportar`):** below 768px convert each row to a card stack with label/value pairs.
- **GoalCard:** edit input keeps current behavior; just ensure the 26px font + button width fits a 360px viewport (likely needs `text-2xl` ramp).
- **ScenarioDrawer:** today is a side sheet; below 1280px should become a full-screen modal.
- **Drop the desktop-only-warning block** once all the above land — keep it gated by an env flag (`NEXT_PUBLIC_MOBILE_READY`) until the work is complete so we can ship incrementally.

**Tests:**
- Playwright at 3 viewport sizes (`360x780`, `820x1180`, `1440x900`) covering: KPIs visible, sidebar drawer toggles, GoalCard edit flow, chart renders without overflow.

Estimate: multi-day. Worth splitting into 3 PRs (sidebar+topbar, KPIs+charts, tables+drawer).
