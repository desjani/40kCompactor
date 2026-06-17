write_build_meta.ps1

This folder contains a small helper to generate `build_meta.json` with git commit metadata.

Usage (PowerShell):

    pwsh ./scripts/write_build_meta.ps1

This will write `build_meta.json` to the repo root with keys:
- commitShort
- commitFull
- timestamp

Optional: install a local git hook to update `build_meta.json` before commits.

Sample pre-commit hook (place in .git/hooks/pre-commit and make executable on *nix):

```bash
#!/bin/sh
# Run the PowerShell helper to update build_meta.json and stage it.
pwsh -NoProfile -ExecutionPolicy Bypass -File "scripts/write_build_meta.ps1"
if [ -f build_meta.json ]; then
    git add build_meta.json
fi
```

On Windows, you can create a `pre-commit` file with the same contents or run the PowerShell script manually before committing.
