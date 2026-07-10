# 40kCompactor

Compacts Warhammer 40k army lists into Discord-friendly output. See README.md for usage, formats, and CLI/library docs.

## Critical rule

**Never modify anything under `v10/`.** It's the version-locked legacy 10th-edition compactor.

## Git hooks (local only — not tracked by git, must be re-set-up after a fresh clone)

- `pre-commit` runs `scripts/write_build_meta.sh`, which regenerates and stages `build_meta.json` with the current commit SHA/timestamp.
- `post-commit`, only when on `main`: pushes to `origin`, then runs `scripts/deploy_unraid.sh`, which SSHes into the Unraid host (METRON), pulls the latest `main`, and rebuilds/restarts the `40k-compactor-bot` Docker container. **Every commit to `main` auto-deploys the live Discord bot.**
- After a fresh clone, re-enable with:
  `chmod +x scripts/write_build_meta.sh scripts/deploy_unraid.sh .git/hooks/pre-commit .git/hooks/post-commit`

## Release checklist (version bumps)

1. `git status` — confirm the working tree is clean before starting, and that all intended source changes (modules/, components/, test/) are staged, not left behind.
2. Bump the version in `package.json`.
3. Add a changelog entry in **both** `components/Changelog.js` and the HTML changelog block in `index.html`.
4. Rebuild the mobile UI: `npm run build` in `apps/mobile-ui/`, so the updated `dist/` lands in the same commit as the version bump.
5. Stage everything together (version, changelogs, mobile dist, any source changes) — never commit changelog/config alone while leaving source changes uncommitted.
6. Commit. (`build_meta.json` regeneration, push, and the Unraid deploy all happen automatically via the git hooks above — no separate steps needed.)
7. `git status` again — confirm the tree is clean and the push/deploy in the commit output succeeded.

## Current work

See OPEN_TASKS.md for the 11th-edition parser status.
