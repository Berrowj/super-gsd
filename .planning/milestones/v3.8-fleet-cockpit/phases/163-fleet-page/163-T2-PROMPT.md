# P163-T2 — page contract tests + manual-check doc (edits-first)

You are the implementer for ONE task. Fresh context. No nested spawns; do NOT
stop on spawnSync EPERM; in-process listen allowed. Do NOT commit.

Task P163-T2 in `163-01-PLAN-LOCKED.md` (same dir, revision 2) is your VERBATIM
contract — this is where the NOGO-round changes live: the SACs must INVOKE the
PRODUCTION page functions (T1 exported them from public/app.js):

1. Rail-render case: production rail renderer with compareLaneRows in the call
   path, fed fixture fleet data, emitting every lane with status, headline, age
   — attention-first ordering asserted on the OUTPUT.
2. Formatter/conflict cases: execute the production formatter/conflict renderer;
   assert fixture-specific strings: No-data rendering distinct from 0 with
   DISTINCT classes; conflict emits BOTH effective and STATE milestone/phase
   values plus source and confidence.
3. HTTP serve case: real server on an ephemeral port with fixture lanes;
   page-consumed endpoints respond with the shapes app.js reads; index.html
   served (or file:// well-formedness check where serving static is out of
   server scope — match what server.cjs actually does; if it does not serve
   public/, add ONLY a static GET for /, /app.js under the same read-only
   contract, per plan).
4. Structural cases: no framework/build/remote assets, ASCII, palette tokens
   present, resume_command inert (no button/link/form/exec surfaces).
5. docs/FLEET-COCKPIT.md gains the MANUAL CHECKS section (phone over LAN,
   visual sort scan), listed as manual, never asserted.

Extend run-self-test.cjs; all existing cases stay green; adapter untouched.

Report: FILES_CHANGED / VERIFICATION (named cases) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 180 words.
