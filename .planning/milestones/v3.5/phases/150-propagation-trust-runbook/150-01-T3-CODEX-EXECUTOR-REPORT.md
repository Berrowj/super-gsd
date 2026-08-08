SALVAGE RECORD (T3 chain: T3 timeout -> T3b fixture-mkdir -> T3c curate-fixture+MSYS -> orchestrator-applied codex diff + timeout bump)
FILES_CHANGED: sgsd-boot.sh, sgsd-registry-sync.sh, sgsd-remote-tmux.sh, scripts/sgsd launcher (modified); tests/propagation/runtime-provenance.test.cjs (created)
VERIFICATION (host): runtime-provenance suite 5/5; boot syntax OK
DEVIATIONS: two orchestrator mechanical repairs applying Codex-authored content — launcher-test MSYS assertion diff (patch tool rejected fine-context; applied verbatim by hand) and spawn timeout 30s->120s (installer pass exceeds 30s in fixture)
ONE_LINER: boot/remote provenance is explicit and verified — no-open smoke, pin-mismatch rejection, provenance-selected cockpit start, doctor reports selected runtime only
STATUS: DONE (salvaged)
