# Agent instructions

## Pull requests and customer safety

Merging to `main` ships to customers automatically. Shipping bad code to customers is unacceptable. Every pull request must be well-tested before merge.

- Work on a branch and review the final diff before merging.
- Run the relevant tests, analysis/lint, builds, and integration or smoke checks for the changed behavior using the repository's pinned production toolchain. Exercise affected user flows and meaningful failure paths; add regression coverage where it verifies the fix.
- Wait for all required CI checks to pass on the exact final PR commit. After further edits or conflict resolution, rerun the affected checks. Do not merge while required checks are failing, unfinished, or skipped unexpectedly, and do not disable or weaken checks to get a merge through.
- Record what was tested and the results in the PR description. A successful compilation alone does not establish that changed behavior works. Documentation-only changes require accurate instructions, valid referenced commands/paths, and applicable CI.

## Repository validation

Production CI is [.github/workflows/gravitas.yml](.github/workflows/gravitas.yml). It runs `docker build --target backend-test .` and `docker build --target frontend-test .`, then builds the production image. These targets run the Go tests and frontend type checks/tests with the pinned toolchains.

## Automatic backend deployment

Every successful push to `main` automatically builds and deploys the verified backend/web image to https://work.gravitas.cool. Publishing an image alone is not release completion. Preserve the deployment job's dependency on all test/build prerequisites, its main-branch restriction, immutable image digest, namespace-scoped `gravitas` environment, rollout checks, and public HTTPS verification in [.github/workflows/gravitas.yml](.github/workflows/gravitas.yml). Do not make normal releases require a separate opt-in variable or manual deployment step. Only pause automatic deployment when the user explicitly requests it.

## Automatic desktop publishing

Preserve native desktop build and smoke checks in `.github/workflows/gravitas.yml`, deployment's dependency on `desktop-verify`, and main-only publication after verified deployment. Before merging changes intended for desktop users, increase version/versionCode and update changes in `desktop-release.config.json`; never overwrite published packages. See [DESKTOP_RELEASES.md](DESKTOP_RELEASES.md).
