# Token Waste (milestone v1.9)

> Soft-warn / degraded only. Per design lock 13:
> "Autonomy continues; evidence tells the truth."
> Halt remains reserved for SGSD-HANDOVER.md:79-86 hard stops.

## Token Waste (milestone v1.9, scope all phases)

### Verdict Counts
| Verdict | Count | % |
|---------|------:|--:|
| ok | 2 | 12.5% |
| warn | 1 | 6.3% |
| degraded | 13 | 81.3% |
| false_positive | 0 | 0.0% |

### Rules Tripped
| Rule | Count |
|------|------:|
| orchestrator_turn_trim | 13 |

### Route Hints
| from_role | reason | count |
|-----------|--------|------:|
| orchestrator | orchestrator_turn_trim_candidate | 14 |

### Top Offenders
| role | phase | total | cache % | findings | verdict |
|------|-------|------:|--------:|---------:|---------|
| orchestrator | 46 | 315,477 | 99.8% | 0 | degraded |
| orchestrator | - | 314,831 | 99.2% | 0 | degraded |
| orchestrator | 41 | 312,217 | 98.6% | 0 | degraded |
| orchestrator | 41 | 312,217 | 98.6% | 0 | degraded |
| orchestrator | 41 | 307,768 | 99.4% | 0 | degraded |
| orchestrator | 42 | 307,768 | 99.4% | 0 | degraded |
| orchestrator | 43 | 307,768 | 99.4% | 0 | degraded |
| orchestrator | 44 | 307,768 | 99.4% | 0 | degraded |
| orchestrator | 45 | 307,768 | 99.4% | 0 | degraded |
| orchestrator | 42 | 305,786 | 98.1% | 0 | degraded |

> Per design lock 13: degraded continues; halt reserved for SGSD-HANDOVER hard stops.

