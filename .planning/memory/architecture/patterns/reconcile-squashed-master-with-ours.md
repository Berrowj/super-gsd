---
name: reconcile-squashed-master-with-ours
description: When master holds squashed equivalents of branch work, verify content then merge -s ours and fast-forward; never force
metadata:
  type: pattern
---

# Reconciling a branch with a squashed master

2026-08-25: `luminaria-hogback` was 179 ahead and 5 behind `origin/master`, so no
fast-forward and no force was permitted. Master's 5 commits turned out to be squashed
equivalents of work the branch already carried in full.

**The check that makes `-s ours` safe.** Run these before merging, and only proceed if
all three hold:

    git diff --name-only --diff-filter=A HEAD origin/master   # 0 = no file unique to master
    git diff --numstat HEAD origin/master --diff-filter=M     # per-file master-only line counts
    # then read the master-only lines in every file with a non-zero + count

In this case the only master-only lines were strictly older: the pre-P167
`register_repo_local_hooks` path that the branch had deliberately deleted, sixteen-hook
guard assertions the branch had replaced, and a five-day-old STATE.md. Master
contributed nothing.

Then `git merge -s ours origin/master`, confirm `HEAD^{tree}` is byte-identical before
and after, confirm `git merge-base --is-ancestor origin/master HEAD`, and push
fast-forward. Master's commits stay reachable in history; no content is lost; nothing is
forced.

**Why not commit-tree squash.** See [[squash-tree-reverts-unmerged-master]]: building a
squash on the origin tip silently deletes whatever master gained after the branch base.
The `-s ours` merge keeps both histories and the deletion check proves the tree.

Related: [[commit-discipline]], [[feedback_push_safety_and_origin_pii]].
