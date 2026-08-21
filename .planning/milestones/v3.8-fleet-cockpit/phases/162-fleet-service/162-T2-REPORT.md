FILES_CHANGED — `status.cjs`, `run-self-test.cjs`, and 7 contractual lane fixtures.

VERIFICATION — RED observed for all named cases. GREEN: status-precedence 73/73; noise-agent-tools 41/41; noise-tokens-absent 41/41; noise-gates-empty 41/41; noise-artifacts-source 41/41; projection-conflict 43/43. In-process T1 regressions: fleet-cache-scheduler 46/46; rollup-first-publish 43/43. Syntax, ASCII, 12-section fixture shape, zero-runtime-require, and diff checks passed.

DEVIATIONS — No commit; spawn-based T1 cases omitted per instruction.

BLOCKERS — None.

ONE_LINER — Four-state precedence, contractual no-data filters, agent-noise removal, and explicit unresolved projection conflicts are implemented.
