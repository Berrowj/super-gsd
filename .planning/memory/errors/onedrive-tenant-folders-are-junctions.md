---
name: onedrive-tenant-folders-are-junctions
description: Windows tenant OneDrive folders are junctions, so readdir isDirectory() is false; stat to see them
metadata:
  type: reference
---

# Tenant OneDrive folders are junctions, not directories

`audit.cjs profilePaths()` hardcoded `OneDrive - John Cullen Lighting`, which was both an
employer identifier in published source and a bug: it only resolved on one machine.

Replacing it with a scan for `OneDrive*` entries using
`entry.isDirectory()` from `fs.readdirSync(home, { withFileTypes: true })` **silently
missed the real folder**. On this machine:

    OneDrive                          isDirectory=true   isSymbolicLink=false
    OneDrive - <tenant>               isDirectory=false  isSymbolicLink=true   <- the real one
    OneDriveCloudTemp                 isDirectory=false  isSymbolicLink=true

The tenant folder is a junction. `isDirectory()` on the dirent does not follow it, so the
naive scan found only the personal `OneDrive` and the profile it needed was never
discovered.

Use `fs.statSync(candidate).isDirectory()` in a try/catch, which follows the link. Verify
by asserting the function actually finds an existing file, not merely that it returns
paths: the broken version returned four plausible paths and zero of them existed.

Related: [[writer-accepts-caller-destination]].
