# Architecture Decisions

## ADR-001: Use Playwright for browser-backed scanning

### Decision
Use Playwright to observe real browser behavior during scans.

### Why
Many marketing technologies are loaded dynamically through scripts, iframes, cookies, and network activity.

### Tradeoffs
- More realistic detection
- More complex runtime
- Requires browser dependency management

## ADR-002: Separate scanner and report-template versions

### Decision
Use the `package.json` version as the single source of truth for the MarTech Scanner product version. Track report structure separately with an explicit report-template version.

The current identities are:

- Scanner version: `0.1.2`
- Report template version: `2.3`

Generated JSON and Markdown reports include both values. Fixture filenames ending in `_v2_3` refer to the report-template version, not the scanner release.

### Why
A scanner release can add CLI or validation behavior without changing report structure, while a report-template revision may need to change independently. Separate labels prevent teammates from mistaking template `2.3` for the application version.

### Tradeoffs
- Version meaning is explicit in CLI output and generated reports.
- Package releases and report-template revisions can evolve independently.
- Maintainers must update the report-template constant and related fixtures when report structure changes.
