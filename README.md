# martech-scanner

A Playwright-based Node.js scanner for reviewing a website's marketing and analytics stack from public browser-visible evidence.

This project is designed as a practical scanner for onboarding and technical review work. Given a domain, it can:

- discover a small set of relevant pages
- open them in a real browser session
- inspect network calls, scripts, cookies, and page globals
- extract common IDs such as `GTM-...`, `G-...`, `AW-...`, `DC-...`, Meta, LinkedIn, TikTok, Pinterest, and The Trade Desk identifiers
- summarize detected vendors and evidence in JSON and Markdown

## What it is

This is a **Node.js command-line tool written in plain JavaScript**.

It uses:

- **Node.js** as the runtime
- **Playwright** for browser automation
- **npm** for package management and script execution

It does **not** currently use:

- React
- Next.js
- Python
- Vite / Webpack / Babel
- `.env` configuration

## Version

Current version: `v0.1.1`
Status: Internal development / teammate testing
Current focus: Improving teammate-facing CLI usability and maintaining consistent scanner and report version metadata.

### Recently completed

- Added CLI help and friendly input validation.
- Added package-backed `--version` output.
- Distinguished scanner version `0.1.1` from report template version `2.3` in generated JSON and Markdown reports.

MarTech Scanner is not yet considered production-ready. The current version should be treated as a working development baseline for future scanner improvements.

Version history is tracked in `CHANGELOG.md`.

The product version comes from `package.json`. Generated reports separately identify
report template version `2.3`, which describes report structure rather than the scanner release.

## Development Workflow

This project uses a release/task-based workflow.

Each change should generally follow this process:

1. Define a small release or task.
2. Create a dedicated Git branch.
3. Update the README/version status if needed.
4. Implement the change.
5. Run automated tests.
6. Complete manual QA where appropriate.
7. Update documentation and `CHANGELOG.md`.
8. Open a pull request.
9. Merge and tag the release.

See `docs/change-workflow.md` for the full repeatable workflow.

## Release Expectations

Before a release is considered complete:

- Relevant tests should pass.
- Manual QA should be completed when scanner behavior changes.
- `README.md` should reflect the current project status.
- `CHANGELOG.md` should include the release.
- Known limitations should be updated if needed.
- The release should be committed, merged, and tagged.

## Current goals

The scanner is intended to help identify browser-visible martech and related web technology, including:

- tag managers
- analytics tools
- media pixels
- consent tools
- supporting systems like CMS or ecommerce signals

Examples of things it can detect include:

- Google Tag Manager
- Google Analytics / GA4
- Google Ads / DoubleClick
- Meta Pixel
- LinkedIn Insight
- TikTok Pixel
- Pinterest Tag
- The Trade Desk
- Adobe-related endpoints
- common consent platforms
- WordPress
- selected session replay / experimentation tools

## Project Structure

```text
.github/
  ISSUE_TEMPLATE/
    feature.md
    bug.md
    refactor.md
  pull_request_template.md

docs/
  architecture-decisions.md
  change-workflow.md
  testing-strategy.md
  backlog.md

examples/
  sample-reports.md

CHANGELOG.md
README.md
.gitignore
package.json
```

### What each file does

- `src/scanner.js`
  Runs the full scan, coordinates the workflow, and writes the output files.

- `src/config.js`
  Stores default settings and constants such as timeouts, max pages, user agents, discovery keywords, and ID extraction rules.

- `src/utils.js`
  Provides general helper functions such as argument parsing, deduping, sleeping, and hostname cleanup.

- `src/detectors.js`
  Identifies vendors and extracts IDs from URLs and text blocks. Generic query parameters such as `id`, `pid`, and `tid` are scoped to known vendor URL contexts to reduce false positives.

- `src/discovery.js`
  Finds and prioritizes same-site pages to scan, balancing path intent with host/subdomain diversity.

- `src/evidence.js`
  Collects and merges page evidence from source inspection, globals, scripts, cookies, requests, and request POST bodies.

- `src/inspectors.js`
  Captures page-level evidence such as scripts, globals, cookies, HTML, and inline source signals.

- `src/browser.js`
  Handles Playwright-specific browser actions such as creating contexts, navigating pages, clicking consent buttons, and stimulating pages so deferred tags can fire.

- `src/reporting.js`
  Builds the final summaries, vendor rollups, ID rollups, and Markdown output.

- `README.md`
Current project overview, usage, and status.

- `CHANGELOG.md`
Version history and release notes.

- `docs/change-workflow.md`
Repeatable workflow for planning, testing, committing, and releasing changes.

- `docs/testing-strategy.md`
Testing principles and expectations.

- `docs/architecture-decisions.md`
Record of important technical decisions.

- `docs/backlog.md`
Candidate future improvements not yet assigned to a release.

- `examples/sample-reports.md`
Placeholder for a future sanitized sample report.

## Requirements

- Node.js 18+ recommended
- npm
- Playwright Chromium browser

## Installation

From the project root:

```bash
npm install
npx playwright install chromium
```

## How to run

Basic usage:

```bash
node src/scanner.js --domain=https://example.com
```

To see every option, default value, and additional examples:

```bash
node src/scanner.js --help
```

To print the installed scanner version:

```bash
node src/scanner.js --version
```

Equivalent npm script:

```bash
npm run scan -- --domain=https://example.com
```

Useful variants:

```bash
node src/scanner.js --domain=https://example.com --headless=false
node src/scanner.js --domain=https://example.com --maxPages=8
node src/scanner.js --domain=https://example.com --enableConsentClick=false
node src/scanner.js --domain=https://example.com --out=./scan-output
```

### Command options

- `--domain=...`
  The site to scan.

- `--headless=false`
  Shows the browser window while the scan runs.

- `--maxPages=8`
  Changes how many ranked discovered pages are scanned. The default is `6`.

- `--enableConsentClick=false`
  Disables the generic consent-button click behavior.

- `--out=./scan-output`
  Changes the output folder.

## Output

Each scan writes:

- a JSON results file
- a Markdown summary file

By default these are written to `./output`.

When a page looks unusually thin, the scanner can also write retry artifacts such as HAR and trace files to `./output/artifacts`.

Typical filenames look like:

- `example.com_results_20260504.json`
- `example.com_summary_20260504.md`
- `example.com_subdirectory_results_20260504.json`
- `example.com_subdirectory_summary_20260504.md`

The filename prefix comes from the normalized input URL without the scheme. Filesystem-unsafe characters are replaced by underscores, and path separators become underscores. For example, `https://example.com/subdirectory/` becomes `example.com_subdirectory`.

If another scan for the same normalized input URL is written on the same day, the scanner appends a two-digit counter before the extension:

- `example.com_results_20260504_01.json`
- `example.com_summary_20260504_01.md`

The JSON report includes both the URLs that were scanned and the full ranked discovery list:

- `scanUrls`
  The capped list of URLs actually scanned, controlled by `maxPages`. The seed URL is kept first, then the scanner prefers sampling across distinct same-site hostnames before filling remaining slots by score.
- `discovered_urls`
  Every discovered same-site URL after filtering, normalization, deduping, and ranking. Each entry has `url`, `rank`, and a boolean `scanned` field.

Vendor findings include confidence levels derived from the evidence source:

- `high` for observed network requests to known vendor endpoints
- `high` for loaded third-party scripts that match known vendor rules
- `medium` for source-only IDs or globals that show configuration but not necessarily firing

Vendor findings also include evidence classification:

- `observed_firing` when browser traffic to a known vendor endpoint was captured
- `present_in_source` when a matching third-party script URL was present on the page
- `inferred` when the vendor was inferred from source-level IDs or globals

### Generated Output Policy

Generated scan results should not be committed unless intentionally added as fixtures or examples.

Ignored by default:

- output/
- reports/
- scan-results/
- temporary browser artifacts
- local logs

Example reports should live in `examples/` and should be clearly marked as examples.

## What the scanner looks at

Depending on the page and scenario, the scanner may use:

- network requests
- third-party script URLs
- iframe URLs
- cookies
- page globals like `dataLayer`
- HTML source
- inline scripts
- `noscript` blocks
- selected request POST bodies

## URL prioritization

Discovery stays within the seed site and same-site subdomains. URLs are ranked by a mix of:

- high-intent paths such as checkout, cart, contact, login, booking, demo, pricing, and trial
- shallow pages and homepages
- distinct same-site hostnames, so subdomains like `shop.example.com`, `app.example.com`, or `support.example.com` are sampled earlier
- lower priority for obvious static/media hosts and asset-like paths

## Typical workflow

1. Normalize the input domain
2. Discover and rank same-site pages, including useful subdomains
3. Open each page in a fresh browser context
4. Capture requests and source signals
5. Optionally click common consent buttons
6. Re-check the page after consent
7. Stimulate the page with lightweight interactions so deferred tags have a chance to fire
8. Retry especially thin pages with richer interactions and artifact capture when needed
9. Extract IDs and classify vendors
10. Write JSON and Markdown output

## Detection notes

The scanner currently works best for tools that expose evidence through browser activity or page source.

Examples:

- GTM container IDs in script or iframe URLs
- GA4 IDs in `gtag` config calls, script URLs, or request evidence
- Google Ads IDs in `gtag` config calls, script URLs, or request evidence
- DoubleClick advertiser IDs in source or request evidence
- TikTok pixel codes in script URLs, inline code, or request payloads
- vendor-scoped Meta, LinkedIn, Pinterest, TikTok, and The Trade Desk IDs in request URLs or payloads
- WordPress signals in paths like `/wp-content/`

## Current limitations

This is still a practical POC / early internal tool, not a full production auditing platform.

Known limitations:

- It only sees what is exposed through public browser activity.
- It can miss tools hidden behind login, geo targeting, or deeper user flows.
- It may miss deferred or conditionally fired tags.
- It does not yet analyze response bodies.
- It does not yet do comprehensive request-payload parsing for every vendor.
- It does not yet run multiple fully separated scenarios like baseline vs post-consent vs conversion flow.
- Confidence scoring and evidence classification are rule-based rather than a full probabilistic model.
- HAR/trace capture is currently used for thin-page retry/debugging rather than exported for every page by default.

## Configuration

There is currently **no `.env` file**.

Configuration is handled through:

- `config.js`
- command-line flags
- `package.json` scripts

## Development notes

This project has already gone through a few iterations to improve:

- modular structure
- Google ID recovery
- false-positive reduction
- host-diverse page discovery
- source-based ID extraction
- centralized evidence collection and merging

Because the rules will evolve, it is a good idea to maintain a small regression set of known domains and expected detections.

The checked-in regression fixture set lives in `test/fixtures/`.

Run the test suite with:

```bash
npm test
```

The default suite includes fast unit/regression tests plus Playwright-backed tests
that run Chromium against local HTTP fixtures. The Playwright-backed tests require
the Chromium browser to be installed with `npx playwright install chromium`.

To run only the fast unit/regression coverage:

```bash
npm run test:unit
```

To run only the Playwright-backed coverage:

```bash
npm run test:playwright
```

Testing principles and expectations are documented in `docs/testing-strategy.md`.

## Suggested next steps

Good next improvements for team use:

- add scenario-based scans
- add an explicit CLI switch for forced HAR/trace export on healthy scans
- add screenshots for fixture/debug capture
- make vendor rules easier to maintain
- standardize report schema for onboarding use
- improve CLI runtime feedback

The scanner runtime feedback should show:

- Start time
- Target URL
- Current page being scanned
- Number of URLs discovered
- Number of URLs queued
- Number of URLs scanned
- Number of detections found
- Retry/failure messages
- Output file location
- Completion status

## Known Limitations

- The scanner is still in early development and should not be treated as production-ready.
- Detection accuracy is expected to improve over future releases.
- Runtime status/progress visibility may still be limited.
- Live websites can change frequently, so manual QA results may vary.
- Generated reports and output format may continue to evolve.
- Example report content may be placeholder or incomplete until the report format stabilizes.

## Safety and scope

This tool is intended for reviewing public website behavior and browser-visible evidence only.

It should be used within normal browsing boundaries and not as a penetration-testing or access-bypass tool.

## Example

```bash
node src/scanner.js --domain=https://example.com --headless=false
```

This runs the scanner against `https://example.com` and shows the browser while scanning.

---

If you expand this into a standard team tool, a good next milestone is to define a stable output schema and keep the regression fixture set current as detector rules evolve.
