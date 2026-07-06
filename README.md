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

Current version: `v0.3.0`
Status: Internal development / teammate testing
Current focus: Making scan coverage limits clear in generated Markdown reports.

### Recently completed

- Added CLI help and friendly input validation.
- Added package-backed `--version` output.
- Distinguished scanner version from report template version `2.6` in generated JSON and Markdown reports.
- Added a teammate-first quick start, first-scan walkthrough, troubleshooting guidance, and interpretation notes.
- Added an analyst-friendly Executive Summary near the top of generated Markdown reports.
- Added Scan Coverage context for scanned pages, discovered-but-not-scanned URLs, failed/partial pages, and low-evidence pages.

MarTech Scanner is not yet considered production-ready. The current version should be treated as a working development baseline for future scanner improvements.

Version history is tracked in `CHANGELOG.md`.

The product version comes from `package.json`. Generated reports separately identify
report template version `2.6`, which describes report structure rather than the scanner release.

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

- Git
- Node.js 18 or newer
- npm (included with Node.js)
- Enough local disk space to install Playwright's Chromium browser

## Quick start

Clone the repository, install its pinned dependencies, and install the Chromium browser used by Playwright:

```bash
git clone https://github.com/pkannok/martech-scanner.git
cd martech-scanner
npm install
npx playwright install chromium
```

Run the complete local test suite before your first scan:

```bash
npm test
```

Run a lightweight first scan, view all CLI options, or check the installed scanner version:

```bash
node src/scanner.js --domain=https://example.com --maxPages=1
node src/scanner.js --help
node src/scanner.js --version
```

The first command writes a JSON report and Markdown summary under `./output`. Generated output is ignored by Git unless it is intentionally added as a fixture or example.

## First scan

Use `example.com` for a safe, lightweight check that the CLI and browser work together:

```bash
node src/scanner.js --domain=https://example.com --maxPages=1
```

During the scan, the terminal reports progress and prints the final file paths. By default, expect files similar to:

- `output/example.com_results_YYYYMMDD.json`
- `output/example.com_summary_YYYYMMDD.md`

If files with those names already exist, the scanner adds a counter such as `_01`. Thin-page retries may also create HAR or trace files under `output/artifacts/`.

Open the Markdown summary in your editor for a readable overview. Open the JSON report when you need structured page-level evidence, discovered URLs, vendor findings, extracted IDs, or scan configuration. Replace `YYYYMMDD` with the date printed in the actual filename and open the files from your editor or file browser.

## Common commands

Quick one-page scan:

```bash
node src/scanner.js --domain=https://example.com --maxPages=1
```

Scan up to eight ranked pages:

```bash
node src/scanner.js --domain=https://example.com --maxPages=8
```

Write reports to a custom directory:

```bash
node src/scanner.js --domain=https://example.com --out=./scan-output
```

Run headlessly (default) or show the browser:

```bash
node src/scanner.js --domain=https://example.com --headless=true
node src/scanner.js --domain=https://example.com --headless=false
```

Use the equivalent npm script:

```bash
npm run scan -- --domain=https://example.com --maxPages=1
```

Run all tests, fast tests only, or browser-backed tests only:

```bash
npm test
npm run test:unit
npm run test:playwright
```

View help or version information:

```bash
node src/scanner.js --help
node src/scanner.js --version
```

### Command options

- `--domain=...`
  The site to scan.

- `--headless=false`
  Shows the browser window while the scan runs.

- `--maxPages=8`
  Changes how many ranked discovered pages are scanned. The default is `6`.

- `--timeout=60000`
  Changes the per-navigation timeout in milliseconds. The default is `45000`; the minimum is `1000`.

- `--enableConsentClick=false`
  Disables the generic consent-button click behavior.

- `--out=./scan-output`
  Changes the output folder.

## Output

Each scan writes:

- a JSON results file
- a Markdown summary file

By default these are written to `./output`.

The Markdown summary starts with an Executive Summary for quick analyst review. It highlights the target, generated timestamp, page/discovery counts, failed-page count, detected vendor and ID counts, consent-interaction status when available, and a caveat that findings reflect browser-visible evidence from the scanned pages only.

The Markdown summary also includes a Scan Coverage section that explains which pages were scanned, which discovered URLs were not scanned when discovery metadata is available, which pages failed or returned partial responses, and which pages produced thin or low evidence. Long coverage lists are capped in Markdown and include an omitted-item count.

The Markdown summary includes an Evidence Type Guide and evidence type labels so analysts can distinguish runtime network evidence from script, source, cookie, iframe/noscript, global, and inferred rule-match signals.

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

## How to interpret results

Vendor detections are based on browser-visible evidence from the pages the scanner actually visits. Runtime network requests show observed browser activity; source-code findings show that configuration or identifiers were present, but do not prove that a tag fired successfully.

The scanner does not inspect GTM accounts, GA4 properties, advertising-platform accounts, CMP admin panels, server-side containers, backend systems, or private APIs. It does not prove that an implementation is complete, correctly configured, compliant, or accurately reporting conversions.

Treat findings as first-pass technical evidence. An analyst should review the scanned URLs, evidence source, consent conditions, confidence labels, and relevant platform configuration before drawing conclusions or sharing results.

## Known limitations

- Coverage depends on which URLs are discovered and selected within the configured `maxPages` limit.
- Not every tag fires on page load; some require consent, interaction, authentication, geography, or a deeper conversion flow.
- Consent banners and the scanner's generic consent click may change which vendors are observed.
- Blocked pages, navigation timeouts, rate limits, bot protection, and login requirements can reduce available evidence.
- Source-code evidence and runtime network evidence are not equivalent; source presence does not prove observed firing.
- The scanner can miss tools hidden behind login, geo targeting, or unscanned user journeys.
- It does not yet analyze response bodies or comprehensively parse every vendor request payload.
- It does not run fully separated baseline, post-consent, and conversion scenarios.
- Confidence scoring and evidence classification are rule-based rather than probabilistic.
- Thin-page retries may create HAR and trace artifacts, but artifacts are not exported for every page by default.

## Configuration

There is currently **no `.env` file**.

Configuration is handled through:

- `config.js`
- command-line flags
- `package.json` scripts

## Troubleshooting

### Playwright package is missing

From the repository root, install the dependencies declared in `package-lock.json`:

```bash
npm install
```

### Chromium browser is missing

If Playwright reports that its browser executable does not exist, install Chromium and rerun the command:

```bash
npx playwright install chromium
```

### Domain or URL is rejected

Use the required `--domain=` form with a hostname or HTTP(S) URL:

```bash
node src/scanner.js --domain=https://example.com --maxPages=1
```

Run `node src/scanner.js --help` to confirm option names and accepted values.

### Navigation times out

Retry with a larger timeout, expressed in milliseconds. A timeout can still indicate a blocked, unusually slow, or unavailable page.

```bash
node src/scanner.js --domain=https://example.com --maxPages=1 --timeout=60000
```

### Results are empty or thin

Check each page's status and evidence in the JSON report. The site may expose little browser-visible martech, require consent or interaction, block automated browsers, or load tags only on URLs that were not scanned. A thin result is not proof that no martech exists.

### Generated files or retry artifacts are hard to find

The CLI prints the final JSON and Markdown paths. Without `--out`, reports are under `./output`; thin-page retry artifacts are under `./output/artifacts`. With a custom output directory, both reports and its `artifacts` subdirectory move there.

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

## Responsible use

Use lightweight settings such as `--maxPages=1` while learning the tool, and increase coverage only when there is a clear review need. Avoid aggressive or repeated scans. Scan only public sites where internal review is appropriate and authorized, stay within normal browsing boundaries, and never use the scanner for access bypass or penetration testing. Review reports for sensitive or misleading context before sharing them broadly.
