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

### Editable goal target

**Phase target:** Fase 4

**Current behavior:** `goalTarget` is hardcoded R$ 600k from `defaults.ts`, persisted in Zustand but no UI to edit.

**Desired:** inline edit on the GoalCard, OR new section in ScenarioDrawer.

### Real recommendation engine

**Phase target:** Out of scope for migration; potentially Fase 6+

**Current behavior:** GoalCard hardcodes "Aporte de R$ 800/mês indexado ao IPCA eleva probabilidade para 91%".

**Desired:** compute the aporte that hits a target probability. Backend solver that, given current scenario + target patrimony + target probability, returns the minimum `monthlyContribution` to hit it.

## Drawer / Form

### Asset list editing UX

**Phase target:** Fase 4

**Current behavior:** PortfolioSection shows fixed 5 rows from defaults; can edit name/weight/yield but cannot add/remove assets.

**Desired:** + button to add asset, × to remove. Validation that weights sum to 1.0.

## Performance / Infra

### Render Hobby upgrade ($7/mo)

**Phase target:** Whenever the user wants 10000+ Monte Carlo trajectories live.

Free tier caps at ~2000 trajectories before timing out. Hobby handles 50000+ comfortably with no cold start. The `nTrajectories` slider in the drawer goes up to 50000 already; just bump localStorage value.

### Cloudflare cache for `/api/macro`

**Phase target:** Optional polish

Macro is cached for 1h server-side. Cloudflare CDN cache could absorb burst traffic without hitting Render at all.

## Testing

### Playwright E2E

**Phase target:** Fase 6

Plan calls for one smoke test (load `/`, verify 4 KPIs render). Currently deferred.

### API integration tests with TestClient

**Phase target:** Could land anytime

Backend has unit tests but no end-to-end flow tests (`POST /simulate` → `POST /simulate/monte-carlo` → assert response shapes match Pydantic).

## Mobile

### Responsive layout below 1280px

**Phase target:** Future

Currently shows "Use desktop ≥1280px" message. Mobile-first redesign would require: collapsible sidebar drawer, single-column layouts, touch-friendly chart interactions.
