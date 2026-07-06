## Testing Principles

- Prefer local fixtures over live websites.
- Use Playwright tests for browser/runtime behavior.
- Use unit tests for parsing, merging, prioritization, and reporting logic.
- Use deterministic report-rendering fixtures to protect analyst-facing Markdown sections without live network scans.
- Use manual QA for live website validation.
- Do not treat live-site changes as test failures unless the scanner itself is broken.
