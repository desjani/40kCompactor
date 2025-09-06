# Open Tasks — cleared

This file records that the previous active tasks/checklist have been cleared to prepare the workspace for incoming bug reports.

Status: ALL PREVIOUS ACTIVE TASKS CLEARED

Summary of current clean state
- Parser parity verified (WTC vs GW App) — comparator: 0 diffs
- `isComplex` removed from runtime outputs; checks are now derived
- Renderer unit test updated & passing
- Known backup/debug artifacts referencing `isComplex` were sanitized or removed

Immediate next steps to triage a user bug report
1. Reproduce: run parser on user-provided input (`WTCCompactSample.txt`) and save parsed JSON to `tmp/last_parse.json`.
2. Run renderer tests and smoke-render the compact output for the sample.
3. If failing, create a focused branch `bugfix/<short-desc>` and add a minimal test that reproduces the bug.
4. Fix code, run tests, and produce a PR-ready commit with a short changelog entry.

How to use this file
- Update the "Immediate next steps" checklist as you take actions.
- The file is intentionally minimal to make it the single source-of-truth for incoming bugs.

Created by automation to reset active tasks.
