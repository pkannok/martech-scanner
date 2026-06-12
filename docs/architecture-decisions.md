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