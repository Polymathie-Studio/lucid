# Changelog

All notable changes to the LUCID package are recorded here. This project has not yet cut a numbered release; changes below are unreleased. The standard document (`LUCID - the standard.md`) carries its own version and changelog.

## Unreleased

### Fixed

- Composition with TEMPER: the CSS now reads TEMPER's real token names, `--color-surface` for the panel background and `--color-success` for the source rung, with the previous `--color-bg-elevated` and `--color-positive` kept as fallbacks. Previously those two roles fell back to LUCID's own defaults even when a TEMPER theme was present, so LUCID did not fully follow the active theme.

### Changed

- README: the npm package name `lucid-reader` is described as planned, not yet published, rather than stated as available.
- Adopted dual licensing to match the corpus: the standard document (`LUCID - the standard.md`) under the Creative Commons Attribution 4.0 International License (`LICENSE-SPEC`), and the code under the Apache License 2.0 (`LICENSE`). The `package.json` license is now `Apache-2.0 AND CC-BY-4.0`.
- `schema.json` `$id` now points at the `Polymathie-xyz/lucid` repository.
