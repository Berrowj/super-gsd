# Fixture: malformed-checkpoint (SA3, adversarial)

ORCHESTRATOR-CHECKPOINT.md missing two REQUIRED_FIELDS (next_unit and
controlling_principle). The Phase 54 manifest-validator MUST reject this
fixture with reason 'manifest_missing_field' and a populated missing_fields
array.

Adversarial PASS == validator rejects with the typed reason.
