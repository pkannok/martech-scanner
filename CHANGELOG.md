# Changelog

## Unreleased

Future work belongs to architecture-aware discovery and the parallel workstreams documented in `docs/backlog.md`.

## v0.4.0 - 2026-08-17

### Added
- Observation-architecture checkpoint covering baseline, delayed, consent-accepted, SPA-triggered, and safe-interaction phases.
- Stable vendor IDs, declarative vendor rules, scoped cookie/global/identifier signals, and deterministic scenario-quality coverage.
- Architecture checkpoint documentation and a discovery-focused roadmap.
- Bounded safe interaction observation with one meaningful scroll and one semantic tab, accordion, or content-reveal activation per page.
- Interaction provenance and diagnostics, including interaction type, label, activation result, and route context where available.
- Deterministic interaction quality fixtures covering scroll, tabs, accordions, unsafe controls, and ambiguous buttons.
- Bounded SPA-triggered observation with safe same-origin route activation, client-side route confirmation, route provenance, and full-navigation comparison fixtures.
- Bounded consent-gated observation with context-aware acceptance, post-consent evidence sampling, and consent diagnostics.
- Bounded delayed observation with baseline/delayed checkpoints, first-observed internal provenance, and deterministic delayed quality fixtures.
- Context-scoped identifier extraction for representative Google Analytics, Google Tag Manager, Meta Pixel, and The Trade Desk URL signals, with positive/negative quality coverage.
- Bounded declarative runtime/global detection for HubSpot, FullStory, Tealium, and Optimizely.
- Cookie-based declarative detection for Adobe Target, Hotjar, HubSpot, and FullStory with scoped exact/prefix matching.
- Initial hybrid vendor-rule architecture with stable internal IDs, scoped declarative URL signals, and representative migrated vendors.
- Structured runtime progress events for scan lifecycle, discovery, page progress, retries, failures, report writing, and completion.
- Initial deterministic detection-quality scenario harness with expected, missed, unexpected, and evidence-gap evaluation.
- Deterministic Markdown report-output regression tests for analyst-facing report sections and edge cases.
- Recommended Manual Review section in generated Markdown reports.
- Detected Vendors by Category section in generated Markdown reports.
- Evidence Type Guide section in generated Markdown reports.
- Evidence type labels for vendor and ID findings where the scanner can derive them from existing report data.

### Changed
- Evidence merging now preserves first-observed phase and activation provenance without duplicating vendor findings.
- Runtime progress and testing documentation now describe the completed observation lifecycle.
- Updated report template version from `2.7` to `2.8` for the Markdown manual review guidance change.
- Updated report template version from `2.6` to `2.7` for the Markdown vendor category grouping change.
- Updated report template version from `2.5` to `2.6` for the Markdown evidence explanation change.

### Testing
- Expanded browser-backed deterministic coverage for delayed initialization, consent activation, SPA routes, safe interaction, provenance, and negative safety cases.

### Known Limitations
- Architecture-aware page/surface selection, authenticated journeys, complex route graphs, preference centers, server-side tagging, response-body analysis, and broad real-world benchmark coverage remain future work.

## v0.3.0 - 2026-07-06

### Added
- Scan Coverage section in generated Markdown reports.
- Scanned-page, discovered-but-not-scanned, and failed/partial-page coverage details with Markdown display limits.

### Changed
- Updated report template version from `2.4` to `2.5` for the Markdown structure change.
- Regenerated report fixtures with coverage context.

## v0.2.0 - 2026-07-06

### Added
- Analyst-friendly Executive Summary near the top of generated Markdown reports.
- Markdown report coverage for discovery, skipped URL, failure, consent, vendor, ID, and thin/low-evidence summary counts.

### Changed
- Updated report template version from `2.3` to `2.4` for the Markdown structure change.
- Regenerated Markdown report fixtures with the new executive summary.

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
