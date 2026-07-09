write_build_meta.sh / deploy_unraid.sh

This folder contains helpers used by the repo's local git hooks (`.git/hooks/pre-commit` and `.git/hooks/post-commit`, not tracked in git so each machine needs them set up once):

- `write_build_meta.sh` writes `build_meta.json` to the repo root with keys:
  - commitShort
  - commitFull
  - timestamp

  Run manually with `./scripts/write_build_meta.sh`, or let `pre-commit` do it automatically.

- `deploy_unraid.sh` SSHes into the Unraid host (METRON), pulls the latest `main`, and rebuilds/restarts the `40k-compactor-bot` Docker container.

  `post-commit` runs this automatically on `main` only (commits on other branches are local-only), pushing to `origin` first so the deploy always reflects the commit that was just made.

The legacy `write_build_meta.ps1` / `deploy_to_unraid.ps1` PowerShell scripts are Windows-only leftovers; the Linux dev environment uses the `.sh` versions above.
