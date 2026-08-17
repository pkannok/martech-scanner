# Detection-quality scenario harness

The quality suite is a small deterministic Playwright harness for measuring detection regressions and evidence quality across controlled local architectures:

```bash
npm run test:quality
```

## Scenario contract

Scenarios live in `test/quality/scenarios.json` and declare expected vendors, intentionally absent vendors, evidence categories, activation mode, observation timing, identifiers, and first-observed provenance. The harness reports missed detections, unexpected detections, evidence gaps, identifier gaps, route gaps, and interaction-safety gaps separately.

## Currently covered

- Conventional scripts, dynamic requests, iframes, cookies, runtime globals, and context-scoped identifiers.
- Baseline versus bounded delayed initialization.
- Consent-accepted network, cookie, and global activation.
- SPA-triggered network, cookie, and global activation, including full-navigation negatives.
- Safe scroll, tab, and accordion activation, plus unsafe and ambiguous control negatives.
- First-observed phase, route, interaction type, and identifier assertions.
- Precision protection through unrelated-host, lookalike, and absent-vendor fixtures.

## Evaluation model

- Expected detection: an expected vendor appears in summarized findings.
- Missed detection: an expected vendor is absent.
- Unexpected detection: a vendor appears that the scenario did not expect.
- Evidence gap: a required evidence category was not observed.
- Provenance gap: the observed phase, route, or interaction differs from scenario truth.
- Passing scenario: no declared gap is present.

The harness retains the full page report for future metrics. The fixture suite is not a comprehensive benchmark: real-world site diversity, architecture-aware discovery, server-side/proxied tagging, authenticated flows, response bodies, large niche-vendor breadth, and long-tail route graphs remain unmeasured.

## Next quality direction

Architecture-aware discovery should add scenarios for candidate-surface coverage, subdomain diversity, page-type classification, and information-gain selection. That work should remain separate from the completed observation phases.
