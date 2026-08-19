FILES_CHANGED / `clean-room.sh`, `assert-install-layout.cjs`, `sgsd-distill-milestone.sh`

VERIFICATION / JS syntax and targeted `git diff --check` pass. Both requested commands ran but exited 1 because every Git Bash subprocess returned `status=null`.

DEVIATIONS / None; no commit.

BLOCKERS / Managed Windows sandbox blocks Git Bash with `CreateFileMapping` error 5, preventing behavioral verification.

ONE_LINER / Clean-room now reports legacy-root state during execution; distill exits 4 with stderr reason when phases exist without corpus documents.
