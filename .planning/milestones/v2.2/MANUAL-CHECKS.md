---
milestone: v2.2
phase: 63
artifact: manual-checks
created: 2026-04-29
operator: jack.berrow
purpose: UI-bound facts that cannot be proven from terminal — operator must verify in Warp and record results.
---

# MANUAL-CHECKS.md — Operator Verification Checklist

These five items are **UI-bound** Warp behaviors. Phase 63 cannot prove them
from terminal evidence alone (Rule 14: "If a Warp UI fact cannot be proven
from terminal, record it as MANUAL-CHECK-REQUIRED rather than pretending it
passed").

For each item: do the check, then record the result by editing
`WARP-SMOKE.md` — change the verdict from `MANUAL-CHECK-REQUIRED` to `PASS`,
`FAIL`, or `PARTIAL` and add a one-line note in the evidence column.

## How To Record A Result

In `WARP-SMOKE.md`, find the matching row (Q1, Q5, Q6, Q9, or Q10) and
change the verdict cell. Example:

```diff
-| Q1 | Does Warp see the SGSD workflow pack ... | MANUAL-CHECK-REQUIRED | ... |
+| Q1 | Does Warp see the SGSD workflow pack ... | PASS | All 5 workflows found in Command Search by name "SGSD: ..." (verified 2026-04-29) | ... |
```

Then commit:
```
git add .planning/milestones/v2.2/WARP-SMOKE.md
git commit -m "docs(p63): record manual check M1 — workflow pack discoverable in Warp Command Search"
```

---

## M1 — Workflow Pack Discoverability (covers Q1)

**Why it matters**: Phase 64 (Workflow Pack Completion) assumes operators
can find these workflows by name. If they don't, Phase 64 is shipping
buttons no one can press.

**Steps**:

1. Open Warp in `C:\Users\jack.berrow\GSDedits`.
2. Open Command Palette (`Ctrl+Shift+P` on Windows; not `Ctrl+P` which is
   paste-last) or click the address-bar command-palette icon.
3. Type `SGSD:` (with the colon).
4. Confirm all 5 workflows appear:
   - `SGSD: Auto Mode`
   - `SGSD: Cockpit Only`
   - `SGSD: Full Preflight`
   - `SGSD: Start`
   - `SGSD: Token Summary`
5. (Optional) Type partial fragments — `auto`, `cockpit`, `preflight`,
   `start`, `token` — and confirm each fragment surfaces the right workflow
   via Warp's fuzzy matching.

**Expected result**: All 5 workflows appear. If any are missing, note which
one and whether reloading Warp / restarting / re-indexing fixes it.

**Record in WARP-SMOKE.md row Q1**.

---

## M2 — Direct claude Launch Detection (covers Q5)

**Why it matters**: Warp's third-party CLI agent utility bar provides voice,
image, file, and diff controls that materially improve operator UX. Phase 65
(rules), Phase 66 (operator guide), and Phase 78 (launch configs) all assume
Warp detects Claude Code when launched directly.

**Steps**:

1. Open a fresh Warp PowerShell tab (no `sg`, no `sgsd`).
2. Run:
   ```powershell
   cd C:\Users\jack.berrow\GSDedits
   claude --dangerously-skip-permissions
   ```
3. Observe the Warp UI:
   - Does a third-party CLI agent **utility bar** appear (typically with
     voice / image / file / diff controls)?
   - Does the input mode indicator show that Warp recognizes the active
     agent?
4. Type `/exit` or Ctrl-C to exit Claude. The utility bar should disappear.

**Expected result**: Utility bar appears for the duration of the Claude
session. If it does not appear, this is an upstream Warp issue worth
filing at `https://github.com/warpdotdev/warp` (track for Phase 96).

**Record in WARP-SMOKE.md row Q5**.

---

## M3 — sg-Launched Claude Detection (covers Q6)

**Why it matters**: Operator's daily flow is `sg`, not `claude` direct. If
Warp fails to detect `sg`-launched Claude even though direct `claude` is
detected, the wrapper-command-detection upstream proposal (Phase 96
candidate) becomes a real ship-blocker for the cockpit operator UX.

**Steps**:

1. Open a fresh Warp PowerShell tab.
2. Run:
   ```powershell
   sg
   ```
3. While Claude is running (you'll see this exact session-start handover),
   observe the Warp UI:
   - Does the third-party CLI utility bar appear?
   - Does Warp's status chip / agent indicator show "Claude Code" or similar?
4. (Phase 63 has confirmed via terminal that the `CLAUDECODE` and
   `TERM_PROGRAM=WarpTerminal` env vars are both set in the `sg`-launched
   Claude process, so Warp's documented detection criteria appear satisfied.)

**Expected result**: Utility bar appears identically to M2. If it appears
in M2 but NOT in M3, the wrapper-command (`sg`) is breaking detection — file
upstream issue and forward to Phase 96.

**Record in WARP-SMOKE.md row Q6**. Pair with M2's result for comparison.

---

## M4 — Launch Config Active-Window Behavior (covers Q9)

**Why it matters**: Phase 78 (Launch Configuration Templates) needs to know
whether saved layouts open in the active window or a new window. The
2026-04-11 spec recorded that on Windows Warp "open in current window" was
unreliable; this item re-tests against the current Warp version.

**Setup** (the launch config dir is currently empty — operator must place
a fixture):

1. Place this minimal fixture at
   `C:\Users\jack.berrow\.warp\launch_configurations\smoke-test.yaml`:
   ```yaml
   ---
   name: SMOKE Test
   windows:
     - tabs:
         - layout:
             cwd: C:\Users\jack.berrow\GSDedits
             commands:
               - exec: pwd
   ```
2. (Or use any existing simple example from
   https://docs.warp.dev/terminal/sessions/launch-configurations.)

**Steps**:

1. From an active Warp window, open the Command Palette (`Ctrl+Shift+P`).
2. Search for "Launch Configuration" or the saved name "SMOKE Test".
3. Click to open it.
4. Observe: did it open in the **current** Warp window (replacing or
   adding to active tabs/panes), or did it spawn a **new** Warp window?
5. Try the same from a fresh Warp window with no current tabs and again
   from a Warp window with multiple tabs already open.

**Expected result**: Per Warp docs (and the 2026-04-11 spec's caveat),
launch configs typically spawn a new window. Confirm whether that's still
true. If the behavior has changed (e.g., active-window targeting now works
on Windows), Phase 78 design changes.

**After test**: delete `smoke-test.yaml` if you don't want it cluttering
your launch list.

**Record in WARP-SMOKE.md row Q9**.

---

## M5 — Codebase Context Indexing State (covers Q10)

**Why it matters**: Codebase Context dramatically improves Warp Agent's
ability to answer SGSD questions without long context dumps. It's also the
prerequisite for Phase 65 rules and Phase 66 operator guide working as
designed. If indexing is disabled or stale, Warp Agent gives wrong answers.

**Steps**:

1. Open Warp Agent in this repo (`Ctrl+\` or the agent input toggle).
2. Ask: `What is in WARP.md?` or `Summarize the SGSD orchestrator skill.`
3. Observe Warp Agent's response:
   - Does it cite specific file paths under `super-gsd/` or `.planning/`?
   - Does it find `WARP.md` and quote from it?
   - Does the agent surface a "codebase context" indicator / chip?
4. (Optional) Open the Warp Agent context settings. Confirm Codebase
   Context is enabled and the indexing status for this repo shows "ready"
   or equivalent.

**Expected result**: Warp Agent finds and cites local files. If it
hallucinates paths or claims it can't see the repo, Codebase Context is
not active.

**Side note**: Phase 63 noted `.warpindexingignore` is missing. Once
operator confirms Codebase Context is working, the next implementation
phase (Phase 65 or a dedicated ignore-pack phase) should add this file
to focus indexing on high-value docs and exclude metrics ledgers.

**Record in WARP-SMOKE.md row Q10**.

---

## After All M1-M5 Are Done

If any item is FAIL, open a follow-up issue or note in `WARP-SMOKE.md`
section 4 ("Implementation Implications") so the affected later phase
(64 / 65 / 67 / 78 / 96) knows. Then update v2.2 status in
`.planning/STATE.md` from `partial` to whatever the matrix demands.
