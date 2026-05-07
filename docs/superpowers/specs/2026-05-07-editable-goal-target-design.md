# Editable Goal Target — Design

**Date:** 2026-05-07
**Status:** Approved
**Owner:** lucgomes

## Problem

`goalTarget` (the patrimony goal — currently R$ 600.000 hardcoded in `DEFAULT_GOAL`) lives in the Zustand store with persist already wired, but there is no UI to edit it. Users cannot tailor the "Probabilidade de meta" KPI or the GoalCard progress bar to their own target.

## Solution

Click-to-edit inline on `GoalCard`. The `R$ 600.000` text becomes a `<input type="number">` on click, saves on Enter or blur, cancels on Esc. The change is immediate (no "Aplicar cenário" needed) because the goal is independent of the scenario form.

## Out of scope

- Adding goal to `scenarioFormSchema` or the drawer.
- Slider, range presets, or "múltiplo do capital" shortcuts.
- Real recommendation engine (the "R$ 800/mês → 91%" line in the card stays hardcoded — tracked separately in FUTURE_IMPROVEMENTS).
- Any change to `KpiRow`'s "Probabilidade de meta" computation logic — it already reads `goalTarget` from the store and will reactively update.

## Architecture

Single-file change to `web/components/visao-geral/GoalCard.tsx`. No new files, no schema changes, no store changes (`setGoalTarget` already exists, persist is already configured via `partialize` in `web/lib/store.ts`).

```
User clicks goal value
  ↓
GoalCard local state: editing = true, draft = current goal
  ↓
<input> renders with autoFocus, value bound to draft
  ↓
User types → draft updates (no commit yet)
  ↓
Enter or blur: validate(draft > 0)
  ├─ valid:    setGoalTarget(draft) → store updates → re-render
  └─ invalid:  silently revert (editing = false, no setGoalTarget call)
  ↓
Esc: revert (editing = false, no setGoalTarget call)
  ↓
Both GoalCard and KpiRow re-render with new goal (both subscribe to store)
```

## Component

`GoalCard.tsx` adds:

- `const [editing, setEditing] = useState(false)`
- `const [draft, setDraft] = useState<string>("")` — kept as string to allow empty/intermediate states while typing
- `const setGoalTarget = useScenarioStore((s) => s.setGoalTarget)`
- A `commit()` helper: parses `draft`, calls `setGoalTarget(parsed)` only if `Number.isFinite(parsed) && parsed > 0`, then `setEditing(false)`.
- A `cancel()` helper: just `setEditing(false)`.

Render swap (around line 27 of current GoalCard):

- **Not editing:** `<button type="button" onClick={() => { setDraft(String(goal)); setEditing(true); }} aria-label="Editar meta" className="text-[26px] font-bold text-ink tabular leading-none cursor-pointer hover:text-brand-bright">{formatRs(goal)}</button>` — semantic button so keyboard users can Enter/Space to enter edit mode.
- **Editing:** `<input type="number" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }} className="text-[26px] font-bold text-ink tabular leading-none w-full bg-bg-3 border border-line rounded-md px-2" />`

## Validation

Only constraint: `> 0`. Implementation:

```ts
const parsed = Number(draft);
if (Number.isFinite(parsed) && parsed > 0) {
  setGoalTarget(parsed);
}
setEditing(false);
```

NaN, empty, zero, and negatives all fall into the `else` branch (no setGoalTarget call) → store stays at the previous value → component re-renders with the old goal. No error message — silent revert.

## Persistence

Already handled by Zustand's `persist` middleware. `goalTarget` is in `partialize` (`web/lib/store.ts:46`). No change needed.

## Reactivity

Both `GoalCard` (this component) and `KpiRow` (`web/components/visao-geral/KpiRow.tsx:14`) subscribe to `goalTarget` via `useScenarioStore((s) => s.goalTarget)`. Calling `setGoalTarget` triggers re-render in both — the "Probabilidade de meta" KPI updates immediately alongside the card.

## Tests (TDD)

`web/tests/goal-card.test.tsx` (new, ~5 cases):

1. **renders the goal as text by default** — finds R$ 600.000, no input present.
2. **clicking the goal switches to input mode** — input is in the document, has the current numeric value pre-filled.
3. **Enter with a valid positive number commits** — calls `setGoalTarget(800000)`, exits edit mode.
4. **Esc cancels** — does NOT call `setGoalTarget`, exits edit mode, store unchanged.
5. **submitting NaN/empty/zero/negative reverts silently** — does NOT call `setGoalTarget`, exits edit mode.

Mocks needed:

- `useSimulate()` returns `{ data: <minimum portfolio shape>, isLoading: false, error: null }` — otherwise GoalCard short-circuits to `<ChartSkeleton />` and the goal node never renders.
- `useScenarioStore` is used as-is (real Zustand store). Tests can call `useScenarioStore.setState({ goalTarget: 600_000 })` in `beforeEach` to reset.

## Accessibility

- The clickable goal is a `<button type="button">` (not a styled `<p>`), so screen readers announce it as actionable and Tab/Enter/Space work natively.
- `aria-label="Editar meta"` on the button.
- `<input>` inherits the goal text styling but is a real form control — keyboard navigation works.

## Risks

- **Conflict with TanStack Query loading state:** if `useSimulate` is loading, GoalCard returns `<ChartSkeleton />` early and the goal isn't visible. Edit mode wouldn't be reachable during refetches — acceptable, matches existing behavior.
- **Race with persist hydration:** `goalTarget` is already in the persist partialize and the providers rehydrate before rendering (see `app/providers.tsx:23`), so no race.
- **Concurrent edits:** none — single user, single tab assumption.

## Implementation cost

~2-3h: edit GoalCard.tsx, write 5 tests, smoke locally, commit, push, FF merge to main, smoke prod.

## Follow-ups (not in this scope)

- Slider or range presets if the click-to-edit UX feels too plain.
- Multi-currency goal (matching the Ativos USD/BRL pattern) if the user expresses interest.
- Wire the "Recomendação investa AI" hardcoded line to a real solver (separate item in FUTURE_IMPROVEMENTS).
