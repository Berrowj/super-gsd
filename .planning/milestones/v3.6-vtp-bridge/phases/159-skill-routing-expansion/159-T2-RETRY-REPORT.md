FILES_CHANGED: None.

VERIFICATION (RED preserved): Not reached. Availability baseline exited 1: `spawnSync C:\Program Files\nodejs\node.exe EPERM`.

DEVIATIONS: Stopped before test/source edits per fail-loud instruction.

BLOCKERS: Sandbox denies the test harness’s nested Node spawn.

ONE_LINER: Re-run P159-T2 unsandboxed; scoped files remain clean.
