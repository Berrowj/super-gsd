{
  "active_milestone": "v1.2",
  "window_ms": 2,
  "audits_scanned": 5,
  "milestones_with_data": 1,
  "per_milestone": [
    {
      "milestone": "v1.2",
      "audits_run": 5,
      "classes": {
        "defects": {
          "warn": 0,
          "fail": 0,
          "total": 0,
          "distinct_phases": []
        },
        "waiting": {
          "warn": 0,
          "fail": 2,
          "total": 2,
          "distinct_phases": [
            "08"
          ]
        },
        "motion": {
          "warn": 0,
          "fail": 0,
          "total": 0,
          "distinct_phases": []
        }
      },
      "total_findings": 2
    }
  ],
  "kill_condition": {
    "triggered": false,
    "rationale": "Window too short — need at least 2 milestones of data to trigger the kill check."
  }
}
