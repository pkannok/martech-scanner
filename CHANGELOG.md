# Changelog

## v0.1.2 - 2026-07-06

### Added
- Teammate-first quick start and first-scan documentation.
- Common command, result interpretation, troubleshooting, and responsible-use guidance.

### Changed
- Consolidated limitations and aligned README examples with supported CLI options and package scripts.
- Updated project status and backlog documentation for the completed onboarding guide.

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
