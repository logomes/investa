# Future Improvements

Items deferred from earlier phases — to be brainstormed/planned when their owning phase comes up.

## Charts

### Monthly resolution for "1A" filter on Evolution chart — ✅ shipped 2026-05-09 (frontend interpolation)

`EvolutionCard` now renders 13 M0–M12 labels on the 1A range, computed via geometric interpolation between Y0 and Y1 (linear fallback when an endpoint is non-positive). MC bands stay annual-only and are hidden on the monthly view.

**Trade-off vs full backend:** small drift (~1-2%) in real-estate Y1 mid-points because financing schedule (SAC/Price month-by-month) is not modeled — portfolio and benchmark match exactly since they're geometric. If precision becomes important, a `POST /api/simulate/monthly` endpoint can replace the front-side interpolation without touching the consumer code.

## Goal Card

### Editable goal target — ✅ shipped 2026-05-09

GoalCard goal value is now click-to-edit: button → input pre-filled with current `goalTarget`, Enter/blur commits via `setGoalTarget`, Esc cancels, invalid input (≤0 or non-numeric) reverts silently. Persists through Zustand and propagates to "Probabilidade de meta" KPI + progress bar.

### Real recommendation engine

**Phase target:** Out of scope for migration; potentially Fase 6+

**Current behavior:** GoalCard hardcodes "Aporte de R$ 800/mês indexado ao IPCA eleva probabilidade para 91%".

**Desired:** compute the aporte that hits a target probability. Backend solver that, given current scenario + target patrimony + target probability, returns the minimum `monthlyContribution` to hit it.

## Ativos

### B3 import (Posição + Movimentação) — ✅ shipped 2026-05-09

`/ativos` ganha botão "Importar B3" que aceita até 2 arquivos do portal Investidor B3 (CSV ou XLSX): `Minha Carteira → Investimentos` (Posição) e `Extratos → Movimentação`. Posição agrega quantidades entre brokers (BTG, Nu, etc) e classifica via Tipo + ticker. Movimentação extrai trades de "Transferência - Liquidação" e computa preço médio ponderado segundo o método fiscal brasileiro. Merge por ticker preserva posições manuais (US stocks, FIIs custom). Avisa se a Movimentação cobre menos de 24 meses (sinaliza que avgPrice pode ser parcial).

**Deferido (próxima rodada):** suporte a Tesouro Direto, Eventos Corporativos (split/inplit/bonificação) que afetam quantidade histórica, integração com Pluggy/Belvo aggregators pra atualização contínua sem upload manual.

### Auto-fetch current quote (`currentPrice` + `asOf`) on add/edit — ✅ shipped 2026-05-09

**Shipped scope:** `GET /api/quotes?ticker=&market=` with provider chain (BR: BRAPI → Yahoo `.SA`; US: Yahoo → Stooq), 60s server cache, 3s per-provider timeout, no API keys. Frontend `AssetDialog` fetches on ticker blur. `AssetsTable` shows a "Preço atual" column with currentPrice converted to BRL (US assets use `macro.usdBrl`), native USD as subtext, relative `asOf`, and per-row refresh button.

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

### Playwright E2E — ✅ shipped 2026-05-09 (smoke only)

`web/e2e/smoke.spec.ts` covers: (a) Visão Geral renders the four KPI labels, (b) GoalCard click-to-edit updates the value and the "Probabilidade de meta" KPI subtitle. Mocks `/api/macro`, `/api/simulate`, `/api/simulate/monte-carlo` via `page.route()` so the test is deterministic and doesn't need the FastAPI backend running. Run with `pnpm test:e2e` from `web/`.

**Still deferred:** wiring into `web-ci.yml` (needs chromium browser caching strategy in CI to avoid 100MB downloads per run) and broader coverage (carteira, ativos, exportar pages).

### API integration tests with TestClient

**Phase target:** Could land anytime

Backend has unit tests but no end-to-end flow tests (`POST /simulate` → `POST /simulate/monte-carlo` → assert response shapes match Pydantic).

## Mobile

### Responsive layout below 1280px

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
