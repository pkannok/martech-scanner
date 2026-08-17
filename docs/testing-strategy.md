# Testing strategy

The scanner uses layered, deterministic validation. Local fixtures are preferred over live sites; live-site manual QA is supplementary and not a stable regression oracle.

## Test layers

- Unit/regression tests cover CLI parsing, detection, evidence merging, discovery ranking, reporting, version consistency, and saved fixtures.
- Vendor-rule tests cover declarative URL, cookie, global, identifier, positive, negative, and stable-ID behavior.
- Quality scenarios use local HTTP fixtures and Playwright to validate expected vendors, evidence categories, activation phases, first-observed provenance, route metadata, and interaction safety.
- Browser-backed tests exercise navigation, page lifecycle, discovery, scan passes, report output, consent, SPA behavior, and safe interaction.

Run the current suites with:

```bash
npm run test:unit
npm run test:vendor-rules
npm run test:quality
npm run test:playwright
npm test
```

Install dependencies and the browser prerequisite when needed:

```bash
npm install
npx playwright install chromium
```

The deterministic quality corpus covers baseline and delayed initialization, consent-gated activation, SPA-triggered activation, safe scroll/tab/accordion interaction, lookalike/unsafe-control negatives, source/network/cookie/global evidence, context-scoped identifiers, and provenance assertions. It is intentionally not comprehensive: it does not measure broad real-world site diversity, architecture-aware discovery quality, authenticated flows, server-side tagging, response-body analysis, or niche-vendor breadth.

## Principles

- Keep fixtures local and deterministic.
- Assert both expected detections and unexpected detections.
- Preserve evidence and first-observed phase semantics.
- Test safety boundaries, not only successful activation.
- Keep report/template fixtures stable unless the contract intentionally changes.
- Do not treat a live-site change as a test failure unless the scanner behavior is demonstrably broken.
