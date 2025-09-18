# Open Tasks

Status (September 2025)

- Guardrails
	- Validator added (scripts/validate_all_formats.mjs) and runs in CI.
	- Tiny tests added and wired (npm test) with Windows-friendly runner.
- Renderer behavior
	- Full Text ignores Combine/Hide toggles (scoped to compact only).
	- Discord outputs (ANSI and plain) are always fenced.

Next small tasks

- Tests
	- Add LF and NRNR cases for enhancement formatting and subunit visibility.
	- Add WTC/NR-GW parity test to ensure Full Text remains unaffected by toggles.
- Docs
	- Note toggle scoping and fenced Discord output (README updated).
	- Keep validator/test commands visible for Windows (PowerShell) users.

Deferred / later

- Consider modest lint tightening once tests cover more paths.
- Expand sample sets for parsers to catch more edge cases.
