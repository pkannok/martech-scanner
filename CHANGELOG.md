# Changelog

## v0.1.1 - 2026-07-06

### Added
- `--version` and `-v` CLI options backed by the package version.
- Scanner and report-template version metadata in generated reports.

### Changed
- Clarified that report template version `2.3` is separate from scanner version `0.1.1`.
- Aligned package-lock metadata with `package.json`.

## v0.1.0 - 2026-06-12

### Added
- Initial scanner workflow.
- Markdown report output.
- Playwright-backed test coverage.

### Changed
- N/A

### Fixed
- N/A

### Known Limitations
- Scanner may miss vendors loaded through delayed or conditional scripts.
- Output format is still evolving.
