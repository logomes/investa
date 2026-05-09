# Future Improvements

Items deferred from earlier phases — to be brainstormed/planned when their owning phase comes up.

## Charts

### Monthly resolution for "1A" filter on Evolution chart

**Phase target:** Fase 4 ou dedicated 3.5

**Current behavior:** TimelineFilter "1A" slices `years` array to 2 points (Y0, Y1) — straight line, low information density.

**Desired:** when 1A is selected, show 12 monthly data points (M0...M12) with compound monthly growth.

**Required changes:**
- **Backend:** add `granularity: "yearly" | "monthly"` param to `/api/simulate` (or new endpoint). Adapt `simulate_real_estate` / `simulate_portfolio` / `simulate_benchmark` in `core/models.py` to compute monthly arrays when requested. Account for monthly compound growth, monthly contributions, and IPCA monthly indexing.
- **Frontend:** `EvolutionCard` watches `range`; on "1A" calls a separate `useSimulateMonthly()` hook. Renders 13 X-labels (M0–M12). Existing yearly hook stays for 5A/10A/Tudo.
- **Tests:** monthly CAGR sanity check vs yearly; matching final values when monthly aggregated to yearly.

Estimate: ~1 day if scoped only to Evolution; longer if applied to other charts (Renda mensal, etc.).

## Goal Card

### Editable goal target — ✅ shipped 2026-05-09

GoalCard goal value is now click-to-edit: button → input pre-filled with current `goalTarget`, Enter/blur commits via `setGoalTarget`, Esc cancels, invalid input (≤0 or non-numeric) reverts silently. Persists through Zustand and propagates to "Probabilidade de meta" KPI + progress bar.

### Real recommendation engine

**Phase target:** Out of scope for migration; potentially Fase 6+

**Current behavior:** GoalCard hardcodes "Aporte de R$ 800/mês indexado ao IPCA eleva probabilidade para 91%".

**Desired:** compute the aporte that hits a target probability. Backend solver that, given current scenario + target patrimony + target probability, returns the minimum `monthlyContribution` to hit it.

## Ativos

### Auto-fetch current quote (`currentPrice` + `asOf`) on add/edit

**Phase target:** Fase 4 (próxima)

**Current behavior:** `/ativos` form coleta `ticker`, `quantity` e `avgPrice` manualmente. Não há cotação de mercado armazenada — todo cálculo de "ganho não realizado" depende de o user re-digitar o preço atual.

**Desired:** quando o user digita o `ticker` (com debounce ~500ms) ou clica num botão "Atualizar cotação" no dialog, o backend busca a cotação atual e pré-preenche um novo campo `currentPrice` + `asOf` (timestamp ISO). `avgPrice` continua sendo o que o user pagou (custo) — não é sobrescrito.

**Schema changes (`web/lib/ativos-schema.ts`):**
```ts
currentPrice: z.number().positive().optional(),
asOf: z.string().datetime().optional(), // ISO 8601
```
Manter `optional()` porque ativos antigos não têm essas cotações.

**Backend route (`api/routers/quotes.py` — novo):**
- `GET /api/quotes?ticker=PETR4&market=BR` → `{ price, currency, asOf, source }`
- BR usa BRAPI (`https://brapi.dev/api/quote/PETR4`) — free tier, sem cadastro pra cotações simples.
- US usa Yahoo Finance via biblioteca `yfinance` ou Finnhub (free 60/min) — escolher na implementação.
- Cache server-side de 60s por ticker (evita rate-limit em digitação rápida).
- Retornar 404 se o ticker não existir (front mostra "Ticker não encontrado").

**UX no `AtivosTable` / dialog de edição:**
- Após o user digitar o ticker e o dialog perder foco do campo (blur), dispara fetch.
- Spinner inline ao lado do campo enquanto carrega.
- Se sucesso: mostra `R$ 32,45 · há 3 min` abaixo do campo, popula hidden state.
- Se erro: mensagem discreta `Cotação indisponível, preencher manual` (não bloqueia salvar).
- Botão "🔄 Atualizar" ao lado, manual.

**Considerações:**
- Fora de pregão: a API retorna a última cotação de fechamento — `asOf` deixa claro que está defasado.
- Para US assets, a cotação vem em USD — armazenar em USD e converter pra BRL no momento da renderização usando o FX de `/api/macro` (já cacheado 1h server-side).
- Não armazenar credenciais de API no front. Toda chamada externa passa pelo backend.

**Tests:**
- Backend: `test_quotes.py` mockando BRAPI e Yahoo, casos OK/404/timeout.
- Frontend: `ativos-quote-fetch.test.tsx` usando MSW, valida debounce, spinner, sucesso, erro silencioso.

**Estimate:** ~1 dia (backend route + cache + front integração + tests). Não inclui FX automático para US (escopo separado).

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
