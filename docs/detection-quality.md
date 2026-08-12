# Detection-quality scenario harness

The detection-quality suite is a small, deterministic Playwright harness for measuring whether scanner changes improve or regress identification quality.

Run it with:

```bash
npm run test:quality
```

## Scenario contract

Scenario metadata lives in `test/quality/scenarios.json`. Each scenario currently supports:

- `name`: stable scenario name
- `purpose`: capability being exercised
- `architecture`: implementation pattern under test
- `path`: local fixture route
- `expectedVendors`: vendors that must be detected
- `expectedAbsentVendors`: vendors intentionally not present; retained as explicit scenario truth for future metrics
- `expectedEvidence`: evidence categories required for each expected vendor
- `activation`: reserved metadata for future consent, interaction, or delayed-activation scenarios; it is not executed yet

Migrated vendors now use stable internal IDs in scenario metadata. Legacy vendors without rules may continue to use display names temporarily; the vendor-rule phase should migrate those cases without changing the harness model.

## Evaluation model

- Expected detection: a vendor in `expectedVendors` appears in the scanner's summarized findings.
- Missed detection: an expected vendor is absent.
- Unexpected detection: any vendor is detected that is not expected. This protects precision, including negative scenarios.
- Evidence gap: an expected vendor is detected, but one or more evidence categories declared in `expectedEvidence` were not observed.
- Passing scenario: no missed detections, unexpected detections, or evidence gaps.

The harness preserves the full page report in the evaluation result, so future metrics can calculate true positives, false negatives, false positives, recall, and precision without changing the scanner result schema.

## Initial corpus

- `traditional-direct-script`: conventional third-party script detection.
- `dynamic-runtime-request`: runtime network observation from page JavaScript.
- `embedded-iframe-technology`: iframe/source-level tag-manager detection.
- `multiple-evidence-vendors`: aggregation of independent script and network detections.
- `negative-lookalike-artifacts`: precision protection against generic IDs and unrelated URLs.
- `cookie-vendor-family`: browser-pipeline validation for Adobe Target, Hotjar, HubSpot, and FullStory cookie evidence.
- `runtime-global-family`: browser-pipeline validation for queue, namespace, and function-like globals.

The corpus is intentionally small and does not measure consent-gated behavior, delayed initialization, SPA navigation, subdomain discovery, ecommerce flows, response bodies, server-side tagging, or niche-vendor breadth yet.

## Architecture observations

The harness and vendor-rule migration exposed several pressures for future catalog expansion:

- Stable IDs now exist for migrated declarative vendors, while legacy vendors still require transitional display-name mapping.
- Detection rules and identifier extraction are concentrated in a large detector module, so adding many vendors will increase branching and false-positive risk.
- Evidence categories are represented across source labels and evidence-type fields, requiring the harness to normalize them before comparison.
- Generic identifier patterns need strong vendor-context scoping, as shown by the negative scenario's lookalike artifacts.

Cookie rules validate exact and prefixed matching without changing scanner result compatibility. The next controlled expansion should cover runtime/global JavaScript signals, followed by context-scoped identifier signals.
