# Fixture: score-69-amber

Synthetic dir that exercises the AMBER path (50 <= score < 70).

Runtime construction in selfTest assertion 12 (`scenarios_half_pass_floor_seven`):
4 rows in failure-injection-log.jsonl with 2 PASS + 2 FAIL produces
`floor((2/4) * 15) = 7` points for the scenarios bucket. When a similar
ratio is applied to the chaos_restart and scenario_suite buckets, the
total composite score lands in the AMBER band (50..69) without
triggering the GREEN exit-0 path.

The test pattern is verified by:
  - selfTest assertion `scenarios_half_pass_floor_seven` (50% PASS -> 7 pts)
  - selfTest assertion `get_color_thresholds` (69 -> AMBER, 70 -> GREEN)

This fixture directory is intentionally empty (README only).
