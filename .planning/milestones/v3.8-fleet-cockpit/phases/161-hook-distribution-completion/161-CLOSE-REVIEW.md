FINDINGS: 3  
CRITICAL: `install.sh:715-716` excludes pre-distribution missing descriptors from later smoke. Distribution then creates those local files, but their syntax/dependency smoke remains skipped; the Clarity fixture lacks local `scripts/lib`/registry. Global smoke proves another topology. Vendored-nine and ordinary smoke remain green, but an SGSD-owned update path was lost.
WARNINGS: 2  
PASS_RATE: 11/11  
ONE_LINER: D1/D2 and updater recovery are evidenced, but T3 bypasses P160 fail-loud validation for SGSD-owned local hooks.  
