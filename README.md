# martech-scanner

A Playwright-based Node.js scanner for reviewing a website's marketing and analytics stack from public browser-visible evidence.

This project is designed as a practical scanner for onboarding and technical review work. Given a domain, it can:

- discover a small set of relevant pages
- open them in a real browser session
- inspect network calls, scripts, cookies, and page globals
- extract common IDs such as `GTM-...`, `G-...`, `AW-...`, `DC-...`, TikTok pixel codes, and selected The Trade Desk identifiers
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
- TikTok Pixel
- The Trade Desk
- Adobe-related endpoints
- common consent platforms
- WordPress
- selected session replay / experimentation tools

## Project structure

```text
martech-scanner/
  package.json
  README.md
  src/
    scanner.js
    config.js
    utils.js
    detectors.js
    discovery.js
    inspectors.js
    browser.js
    reporting.js
  test/
    fixtures/
    *.test.js
```

### What each file does

- `scanner.js`
  Runs the full scan, coordinates the workflow, and writes the output files.

- `config.js`
  Stores default settings and constants such as timeouts, max pages, user agents, and ID regex rules.

- `utils.js`
  Provides general helper functions such as argument parsing, deduping, sleeping, and hostname cleanup.

- `detectors.js`
  Identifies vendors and extracts IDs from URLs and text blocks.

- `discovery.js`
  Finds and prioritizes internal pages to scan.

- `inspectors.js`
  Captures page-level evidence such as scripts, globals, cookies, HTML, and inline source signals.

- `browser.js`
  Handles Playwright-specific browser actions such as creating contexts, navigating pages, clicking consent buttons, and stimulating pages so deferred tags can fire.

- `reporting.js`
  Builds the final summaries, vendor rollups, ID rollups, and Markdown output.

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
  Increases the number of discovered pages to scan.

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

- `example.com_results_v2_3.json`
- `example.com_summary_v2_3.md`

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

## Typical workflow

1. Normalize the input domain
2. Discover a small set of internal pages
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
- The Trade Desk advertiser IDs in request URLs or payloads
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
- It does not yet provide formal confidence scoring.
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
- page discovery
- source-based ID extraction

Because the rules will evolve, it is a good idea to maintain a small regression set of known domains and expected detections.

The checked-in regression fixture set lives in `test/fixtures/`.

Run the test suite with:

```bash
npm test
```

The default suite includes fast unit/regression tests plus Playwright-backed tests
that run Chromium against local HTTP fixtures. To run only the Playwright-backed
coverage:

```bash
npm run test:playwright
```

## Suggested next steps

Good next improvements for team use:

- add confidence levels to findings
- distinguish `observed firing` vs `present in source` vs `inferred`
- add scenario-based scans
- add an explicit CLI switch for forced HAR/trace export on healthy scans
- add screenshots for fixture/debug capture
- make vendor rules easier to maintain
- standardize report schema for onboarding use

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
