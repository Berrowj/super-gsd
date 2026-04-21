# Round 2 — Brief 1: MUDA learning loop rebuttals

## Architect (MODIFY — accepted Moonshot's seed library)
"Contrarian's 3 probes are a valid floor but not a ceiling; seed library collapses the build-order dilemma."
- Final Q1: seed library + write+read in one phase
- Final Q2: two-tier via hit_count counter (accepts Moonshot's mechanism)
- Final Q3: conditional phase-close holds (tighter than milestone-close)
- Final Q4: defer fold until next milestone proves overlap is real
- Shift: accepted kill condition — instrument recurrence metric, abandon if zero recurrence in next milestone

## Pragmatist (SHIFTED toward Contrarian — cost-aware retrenchment)
Surfaced critical blocker: `.planning/phases/08-sgsd-self-audit/scratch-findings.md` contains 18 findings including **FINDING-18: brv-curate install is broken** — seeding into a broken pipe ships zero value.
- Final Q1: **Contrarian's 3 probes win short-term. Write-path only + 3 probes.**
- Final Q2: NO seed library until install breakage fixed + milestone 2 close
- Final Q3: pre-flight Haiku check math — cost exceeds benefit until lesson count > ~20 validated entries
- Final Q4: folding is 3-4h + regression risk; not this week
- Updated plan: Day 1 = fix FINDING-17/18 install blockers (0.5-2h); Day 2 = write path + 3 probes (~4h). Total 6h.

## Contrarian (SOFTENED — narrow build acceptable)
**Critical observation**: the 12 audit findings are **installation defects** (typos, missing config keys, broken aliases) — NOT dispatch-pattern waste. Seeding the store with install-time bugs teaches the classifier nothing about runtime dispatch waste.
- Final Q1: build NARROWLY — write path only; read path only after 2 milestones of real dispatch data
- Final Q2: Pragmatist wins on expected value if cadence is milestone-close
- Final Q3: sample-of-one fallacy NOT addressed by seed library — it's restated with more items
- Final Q4: Architect's no-op read stub preserves optionality at near-zero cost
- Concession: build alternative is acceptable IF kill condition is real

## Moonshot (RETRENCHED — stripped the seed library)
Accepted Contrarian's insight that today's 12 are install defects, not dispatch waste. Stripped seed library + hit_count + fold entirely.
- Final Q1: strip seed library. Write path trivially cheap so store self-populates if recurrence actually exists.
- Final Q2: strip two-tier machinery; keep it flat
- Final Q3: **keep TWICE per phase** — Haiku pre-flight writes 3-field JSON stub; phase-close appends only if run produced deviation/blocker. Non-empty loop from day one, <5.5h.
- Final Q4: token-audit stays parallel
- Key retrenchment: "the ambitious version is a loop that self-corrects without human curation — that goal is preserved by write path being always-on; strip the pre-population"

## Convergence map

Unanimous R2 (4/4):
- Write path first (Contrarian softened to "narrow build", accepts write path)
- Fix FINDING-17 + FINDING-18 install blockers first (Pragmatist raised; nobody disputes)
- Don't fold sgsd-token-audit this week
- Accept kill condition tied to recurrence in next milestone(s)

Strong consensus (3/4):
- NO seed library (Moonshot withdrew, Pragmatist + Contrarian against; only R2-Architect held it)
- Keep it FLAT single-tier for now (Pragmatist + Contrarian + Moonshot retrenched against two-tier; Architect defends as "cheap query flag")
- Include 3 watchdog probes as parallel detection (Pragmatist + Contrarian endorse; Architect accepts as "floor"; Moonshot silent)

Residual split — automation cadence:
- Architect: conditional phase-close (file/diff magnitude gate)
- Pragmatist: milestone-close only
- Moonshot: twice per phase (cheap pre-flight + deep close)
- Contrarian: softened toward milestone-close but not adamant
