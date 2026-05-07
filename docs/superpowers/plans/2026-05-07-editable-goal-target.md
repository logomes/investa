# Editable Goal Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add click-to-edit inline editing of `goalTarget` (R$ 600k default) on `GoalCard.tsx`, persisted automatically via existing Zustand store.

**Architecture:** Single-file frontend change. `GoalCard` adds local `editing`/`draft` state. Click on the goal value swaps `<button>` → `<input type=number>`. Enter or blur commits via `setGoalTarget` (already in store). Esc cancels. Validation: `> 0`; invalid input silently reverts. Reactivity is automatic — `KpiRow` also subscribes to `goalTarget` from the store and re-renders.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind v4, Zustand v5 (persist already wired), React 18, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-07-editable-goal-target-design.md`

---

## File Structure

- **Modify:** `web/components/visao-geral/GoalCard.tsx` — add `useState` for editing/draft + commit/cancel handlers + button↔input swap
- **Create:** `web/tests/goal-card.test.tsx` — 5 TDD tests covering display, click-to-enter-edit, Enter commits, Esc cancels, invalid revert

No store changes (`setGoalTarget` exists at `web/lib/store.ts:29`). No schema changes. No drawer changes.

---

## Task 1: Branch + baseline check

**Files:** none (git only)

- [ ] **Step 1: Confirm clean tree on main**

```bash
git status
```

Expected: `On branch main`, `working tree clean`, `up to date with 'origin/main'`.

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b feat/editable-goal
```

Expected: `Switched to a new branch 'feat/editable-goal'`.

- [ ] **Step 3: Run full test suite to confirm green baseline**

```bash
cd web && npx vitest run 2>&1 | tail -5
```

Expected: `Test Files  42 passed (42)`, `Tests  250 passed (250)` (or current totals — must all pass).

---

## Task 2: Test file scaffolding + first test (renders default)

**Files:**
- Test: `web/tests/goal-card.test.tsx` (new)

- [ ] **Step 1: Write the failing test (renders default value)**

Create `web/tests/goal-card.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoalCard } from "@/components/visao-geral/GoalCard";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_GOAL } from "@/lib/defaults";
import type { SimulateOut } from "@/lib/api-types";

const fakeSim: SimulateOut = {
  realEstate: { label: "RE", color: "#fff", years: [0, 1], patrimony: [100, 110], annualIncome: [0, 12], cumulativeIncome: [0, 12] },
  portfolio: { label: "PF", color: "#fff", years: [0, 1], patrimony: [230_000, 250_000], annualIncome: [0, 5_000], cumulativeIncome: [0, 5_000] },
  benchmark: { label: "BM", color: "#fff", years: [0, 1], patrimony: [100, 110], annualIncome: [0, 0], cumulativeIncome: [0, 0] },
  sensitivity: [],
  taxComparison: [],
};

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: fakeSim, isLoading: false, error: null, refetch: vi.fn() }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("GoalCard editable target", () => {
  beforeEach(() => {
    useScenarioStore.setState({ goalTarget: DEFAULT_GOAL });
  });

  it("renders the goal as a button by default (not in edit mode)", () => {
    render(wrap(<GoalCard />));
    expect(screen.getByRole("button", { name: /editar meta/i })).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument(); // no input yet
    expect(screen.getByRole("button", { name: /editar meta/i }).textContent).toMatch(/600/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run tests/goal-card.test.tsx 2>&1 | tail -15
```

Expected: FAIL — `Unable to find an accessible element with the role "button" and name /editar meta/i` (because GoalCard currently renders a `<p>`, not a button).

- [ ] **Step 3: Make minimal change to GoalCard so the test passes**

Open `web/components/visao-geral/GoalCard.tsx`. Replace lines 27 (the `<p>` with `formatRs(goal)`):

Find:
```tsx
      <p className="text-[26px] font-bold text-ink tabular leading-none">{formatRs(goal)}</p>
```

Replace with:
```tsx
      <button
        type="button"
        aria-label="Editar meta"
        className="text-[26px] font-bold text-ink tabular leading-none cursor-pointer hover:text-brand-bright text-left"
      >
        {formatRs(goal)}
      </button>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run tests/goal-card.test.tsx 2>&1 | tail -5
```

Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/tests/goal-card.test.tsx web/components/visao-geral/GoalCard.tsx
git commit -m "$(cat <<'EOF'
feat(goal-card): convert goal value to a button (entry point for edit)

First TDD step toward editable goalTarget. The <p> becomes a semantic
<button> with aria-label, so keyboard users can enter edit mode and
screen readers announce it as actionable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Click-to-edit transitions to input mode

**Files:**
- Modify: `web/components/visao-geral/GoalCard.tsx`
- Test: `web/tests/goal-card.test.tsx`

- [ ] **Step 1: Add the failing test**

Append inside the `describe` block in `web/tests/goal-card.test.tsx`:

```tsx
  it("clicking the goal switches to input mode with the current value pre-filled", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(wrap(<GoalCard />));
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    const input = screen.getByRole("spinbutton");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe(String(DEFAULT_GOAL));
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run tests/goal-card.test.tsx 2>&1 | tail -10
```

Expected: FAIL on `getByRole("spinbutton")` — input doesn't exist yet.

- [ ] **Step 3: Implement editing state + input swap in GoalCard**

Open `web/components/visao-geral/GoalCard.tsx`. Add `useState` import at the top:

Find:
```tsx
"use client";

import { Target } from "lucide-react";
```

Replace with:
```tsx
"use client";

import { useState } from "react";
import { Target } from "lucide-react";
```

Add `setGoalTarget` to the store selector. Find:
```tsx
  const goal = useScenarioStore((s) => s.goalTarget);
```

Replace with:
```tsx
  const goal = useScenarioStore((s) => s.goalTarget);
  const setGoalTarget = useScenarioStore((s) => s.setGoalTarget);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
```

Replace the `<button>` block from Task 2 with the conditional swap:

Find:
```tsx
      <button
        type="button"
        aria-label="Editar meta"
        className="text-[26px] font-bold text-ink tabular leading-none cursor-pointer hover:text-brand-bright text-left"
      >
        {formatRs(goal)}
      </button>
```

Replace with:
```tsx
      {editing ? (
        <input
          type="number"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Editar meta"
          className="text-[26px] font-bold text-ink tabular leading-none w-full bg-bg-3 border border-line rounded-md px-2 py-0.5"
        />
      ) : (
        <button
          type="button"
          aria-label="Editar meta"
          onClick={() => {
            setDraft(String(goal));
            setEditing(true);
          }}
          className="text-[26px] font-bold text-ink tabular leading-none cursor-pointer hover:text-brand-bright text-left"
        >
          {formatRs(goal)}
        </button>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run tests/goal-card.test.tsx 2>&1 | tail -5
```

Expected: `Tests  2 passed (2)`.

- [ ] **Step 5: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/tests/goal-card.test.tsx web/components/visao-geral/GoalCard.tsx
git commit -m "$(cat <<'EOF'
feat(goal-card): click-to-edit switches goal value to input

useState gates between display button and edit input. Draft starts
pre-filled with the current goal value so the user can simply
overwrite or tweak.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Enter commits and exits edit mode

**Files:**
- Modify: `web/components/visao-geral/GoalCard.tsx`
- Test: `web/tests/goal-card.test.tsx`

- [ ] **Step 1: Add the failing test**

Append inside the `describe` block:

```tsx
  it("pressing Enter with a valid positive number commits and exits edit mode", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(wrap(<GoalCard />));
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "800000");
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(800_000);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar meta/i }).textContent).toMatch(/800/);
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run tests/goal-card.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `goalTarget` stays at `DEFAULT_GOAL` because the input has no `onKeyDown` handler yet.

- [ ] **Step 3: Add commit/cancel handlers and `onKeyDown` on input**

Open `web/components/visao-geral/GoalCard.tsx`. After the `useState` lines added in Task 3, add the helpers (before the `if (sim.isLoading)` early return):

Find:
```tsx
  const [draft, setDraft] = useState<string>("");

  if (sim.isLoading) return <ChartSkeleton height={420} />;
```

Replace with:
```tsx
  const [draft, setDraft] = useState<string>("");

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed > 0) {
      setGoalTarget(parsed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  if (sim.isLoading) return <ChartSkeleton height={420} />;
```

Wire `onKeyDown` (and `onBlur` for completeness) on the `<input>`:

Find:
```tsx
        <input
          type="number"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Editar meta"
          className="text-[26px] font-bold text-ink tabular leading-none w-full bg-bg-3 border border-line rounded-md px-2 py-0.5"
        />
```

Replace with:
```tsx
        <input
          type="number"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          aria-label="Editar meta"
          className="text-[26px] font-bold text-ink tabular leading-none w-full bg-bg-3 border border-line rounded-md px-2 py-0.5"
        />
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run tests/goal-card.test.tsx 2>&1 | tail -5
```

Expected: `Tests  3 passed (3)`.

- [ ] **Step 5: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/tests/goal-card.test.tsx web/components/visao-geral/GoalCard.tsx
git commit -m "$(cat <<'EOF'
feat(goal-card): commit on Enter/blur, persist via setGoalTarget

Validates parsed draft > 0 before calling setGoalTarget. Invalid input
is silently dropped (no error UI) and edit mode exits either way.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Esc cancels without committing

**Files:**
- Test: `web/tests/goal-card.test.tsx`

- [ ] **Step 1: Add the failing test**

Append inside the `describe` block:

```tsx
  it("pressing Esc cancels without calling setGoalTarget", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(wrap(<GoalCard />));
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "999999");
    await user.keyboard("{Escape}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar meta/i }).textContent).toMatch(/600/);
  });
```

- [ ] **Step 2: Run test to verify it passes**

The `cancel()` handler from Task 4 already covers Esc. No code change needed.

```bash
cd web && npx vitest run tests/goal-card.test.tsx 2>&1 | tail -5
```

Expected: `Tests  4 passed (4)`.

- [ ] **Step 3: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/tests/goal-card.test.tsx
git commit -m "$(cat <<'EOF'
test(goal-card): cover Esc cancel path

Confirms the cancel handler from the previous commit reverts cleanly
without touching the store.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Invalid input (NaN, empty, zero, negative) reverts silently

**Files:**
- Test: `web/tests/goal-card.test.tsx`

- [ ] **Step 1: Add the failing test (or passing — verifying robustness)**

Append inside the `describe` block:

```tsx
  it("submitting empty/zero/negative reverts silently without changing the store", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(wrap(<GoalCard />));

    // Try empty
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    await user.clear(screen.getByRole("spinbutton"));
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);

    // Try zero
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "0");
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);

    // Try negative
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "-100");
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);
  });
```

- [ ] **Step 2: Run test to verify it passes**

`commit()` already gates on `Number.isFinite(parsed) && parsed > 0`, so empty (NaN), zero, and negatives all skip `setGoalTarget`.

```bash
cd web && npx vitest run tests/goal-card.test.tsx 2>&1 | tail -5
```

Expected: `Tests  5 passed (5)`.

- [ ] **Step 3: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/tests/goal-card.test.tsx
git commit -m "$(cat <<'EOF'
test(goal-card): cover invalid-input revert path

Empty, zero, and negative inputs all silently revert via the
Number.isFinite && > 0 guard in commit().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full suite + lint + typecheck + smoke local

**Files:** none (verification)

- [ ] **Step 1: Run the full vitest suite**

```bash
cd web && npx vitest run 2>&1 | tail -5
```

Expected: all test files pass. New count = old + 1 file, old + 5 tests.

- [ ] **Step 2: Run typecheck**

```bash
cd web && npx tsc --noEmit 2>&1 | tail -5
```

Expected: empty output (no errors).

- [ ] **Step 3: Run lint**

```bash
cd web && npm run lint 2>&1 | tail -10
```

Expected: no errors. Warnings about unused imports (if any) must be fixed before continuing.

- [ ] **Step 4: Smoke local — start dev server (if not running)**

```bash
pgrep -f "next dev" >/dev/null && echo "already running" || (cd web && npm run dev > /tmp/next-dev.log 2>&1 &)
sleep 4 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
```

Expected: `200` or `302`.

- [ ] **Step 5: Manual UI smoke (user-facing — describe in commit, no automation)**

Tell the user: open `http://localhost:3000`, locate the GoalCard ("Meta patrimonial"), click on `R$ 600.000`, verify the input appears with `600000` pre-filled, type `850000`, press Enter, verify (a) the card now shows `R$ 850.000`, (b) the progress bar adjusts, and (c) the "Probabilidade de meta" KPI in the top row also reflects the new goal. Press Esc on a second edit attempt to confirm cancel works.

If the user confirms the smoke passes, proceed. If not, debug and add a regression test before continuing.

---

## Task 8: Update FUTURE_IMPROVEMENTS, push, FF merge, smoke prod, cleanup

**Files:**
- Modify: `docs/superpowers/FUTURE_IMPROVEMENTS.md` — mark Editable goal target as shipped

- [ ] **Step 1: Mark the item as shipped in FUTURE_IMPROVEMENTS**

Open `docs/superpowers/FUTURE_IMPROVEMENTS.md`. Find:

```markdown
### Editable goal target

**Phase target:** Fase 4

**Current behavior:** `goalTarget` is hardcoded R$ 600k from `defaults.ts`, persisted in Zustand but no UI to edit.

**Desired:** inline edit on the GoalCard, OR new section in ScenarioDrawer.
```

Replace with:

```markdown
### Editable goal target — ✅ shipped 2026-05-07

GoalCard now supports inline click-to-edit on the goal value. Enter or blur saves (validates `> 0`); Esc cancels. Persists via existing Zustand store; KpiRow's "Probabilidade de meta" reacts automatically.
```

- [ ] **Step 2: Commit the docs update**

```bash
cd /home/lucgomes/workspace/investa
git add docs/superpowers/FUTURE_IMPROVEMENTS.md
git commit -m "$(cat <<'EOF'
docs: mark Editable goal target as shipped

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/editable-goal
```

Expected: `Branch 'feat/editable-goal' set up to track remote branch...`.

- [ ] **Step 4: FF merge to main and push (no PR — gh CLI not installed)**

```bash
git checkout main
git merge --ff-only feat/editable-goal
git push origin main
```

Expected: `Fast-forward`, then `main -> main`.

- [ ] **Step 5: Smoke prod (after Vercel rebuild ~2min)**

Tell the user: wait ~2 minutes for Vercel rebuild, hard-refresh `https://investa-logomes-projects.vercel.app/`, click on the goal value in the Meta patrimonial card, change to `850000`, press Enter, verify the card and the KPI both update. Reload (F5) and confirm the new goal persists.

- [ ] **Step 6: After user confirms smoke prod, delete the feature branch**

```bash
git branch -d feat/editable-goal
git push origin --delete feat/editable-goal
```

Expected: `Deleted branch feat/editable-goal`, then `[deleted] feat/editable-goal`.

---

## Done

- 5 new tests in `web/tests/goal-card.test.tsx`
- 1 modified file: `web/components/visao-geral/GoalCard.tsx`
- 1 docs update marking the item shipped
- 7 atomic commits, FF-merged to main, smoke-validated in prod
