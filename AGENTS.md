# Dungeon playtest repository instructions

This repository delivers the compiled Dungeon browser client. Apply gameplay changes in the source project and publish the approved production output under `site/`. Keep this repository and its issues, PRs, and artifacts suitable for public testers. Treat saves and diagnostic material as private by default.

For a client release, verify the generated HTML, hashed assets, icons, manifest, and service worker against the file and integrity checks in the [Pages workflow](.github/workflows/pages.yml). Check the manifest scope, release version, and SHA-256 hashes before merging. Review the public diff and PR description. Documentation-only changes should preserve the `site/` tree.

GitHub Pages deploys on a push to `main`. Check the [workflow run](https://github.com/etisgor/dungeon-test/actions/workflows/pages.yml) for the merged commit. In a test browser profile, verify the published build version, the Controls dialog, and offline readiness. For game updates, exercise the changed loop and any affected save or update behavior. Restore a previous known-good client with a revert PR when a release needs to be rolled back. [Play Dungeon](https://etisgor.github.io/dungeon-test/)
