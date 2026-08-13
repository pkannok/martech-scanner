## Testing Principles

- Prefer local fixtures over live websites.
- Use Playwright tests for browser/runtime behavior.
- Use unit tests for parsing, merging, prioritization, and reporting logic.
- Use deterministic report-rendering fixtures to protect analyst-facing Markdown sections without live network scans.
- Use the deterministic detection-quality scenario harness to compare expected vendors, unexpected vendors, and evidence expectations across controlled local architectures.
- Cover observation phases explicitly in local fixtures: baseline, delayed, consent-accepted, spa-navigation, and interaction.
- Assert first-observed provenance and route/interaction metadata for phase-specific evidence.
- Include negative safety fixtures proving unsafe controls are not attempted, not only that no vendor was detected.
- Use manual QA for live website validation.
- Do not treat live-site changes as test failures unless the scanner itself is broken.
