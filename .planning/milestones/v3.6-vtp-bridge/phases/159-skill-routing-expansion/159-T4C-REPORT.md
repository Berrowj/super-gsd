FILES_CHANGED / `super-gsd/hooks/sgsd-intent-classifier.cjs`  
VERIFICATION / `node --check` passed; assertion block confirms serialization now precedes latency capture and append.  
DEVIATIONS / None.  
BLOCKERS / None.  
ONE_LINER / Restored null-placeholder ordering so kb-shadow `latency_ms` includes JSON serialization latency while preserving T4/T2/T1 behavior.
