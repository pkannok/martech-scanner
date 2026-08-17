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

- Scanner version: `0.4.0`
- Report template version: `2.8`

Generated JSON and Markdown reports include both values. Fixture filenames ending in `_v2_8` refer to the report-template version, not the scanner release.

### Why
A scanner release can add CLI or validation behavior without changing report structure, while a report-template revision may need to change independently. Separate labels prevent teammates from mistaking template `2.8` for the application version.

### Tradeoffs
- Version meaning is explicit in CLI output and generated reports.
- Package releases and report-template revisions can evolve independently.
- Maintainers must update the report-template constant and related fixtures when report structure changes.

## ADR-003: Observation architecture checkpoint

### Decision

The `0.4.0` baseline treats baseline, delayed, consent-accepted, SPA-triggered, and safe-interaction observation as bounded phases over a shared evidence pipeline. Network listeners remain active while stateful evidence is re-sampled at phase checkpoints. Evidence is merged once per page and retains internal first-observed phase, route, consent, and interaction provenance without duplicating vendor findings.

### Boundary

The scanner intentionally does not claim complete coverage. Consent recognition is conservative, SPA observation activates one safe same-origin route, and interaction observation is limited to safe, bounded controls. Authenticated journeys, complex route graphs, preference centers, infinite scroll, server-side tagging, response-body analysis, and architecture-aware page selection remain outside this checkpoint.

### Next phase

Architecture-aware discovery is next: richer candidate collection, surface classification, diversity/information-gain selection, and coverage diagnostics. Vendor expansion, CI, deeper payload analysis, confidence modeling, and real-world benchmarking continue as parallel workstreams.
