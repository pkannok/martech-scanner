# MarTech Scan Summary

- **Scanner version:** 0.3.0
- **Report template version:** 2.8
- **Domain:** https://traderjoes.com
- **Scanned at:** 2026-03-31T16:58:19.278Z
- **Pages scanned:** 6
- **Max pages configured:** 6
- **Consent click enabled:** true

## Executive Summary

- Target: https://traderjoes.com
- Generated at: 2026-03-31T16:58:19.278Z
- Pages scanned: 6
- Failed pages: 0
- Vendors detected: 10
- IDs detected: 8
- Consent interaction: Enabled; interaction captured on 5 of 6 page(s).
- Thin / low-evidence pages: 0

This report reflects browser-visible evidence from the scanned pages only and should be reviewed by an analyst before being treated as complete.

## Scan Coverage

Coverage is limited to the URLs discovered and selected during this run.

- Seed / target: https://traderjoes.com
- Total pages scanned: 6
- Total URLs discovered: not recorded
- Discovered but not scanned: not recorded
- Failed pages: 0
- Thin / low-evidence pages: 0

### Scanned Pages

- https://traderjoes.com
  - Status: ok; HTTP: 200
  - Evidence counts: 14 network, 6 scripts, 4 source IDs, 28 cookies
  - Notes: none
- https://locations.traderjoes.com/
  - Status: ok; HTTP: 200
  - Evidence counts: 10 network, 4 scripts, 8 source IDs, 5 cookies
  - Notes: none
- https://traderjoes.com/home/products/category/meat-seafood-and-plant-based-122
  - Status: ok; HTTP: 200
  - Evidence counts: 14 network, 6 scripts, 4 source IDs, 29 cookies
  - Notes: none
- https://traderjoes.com/home/products/category/flowers-and-plants-203
  - Status: ok; HTTP: 200
  - Evidence counts: 14 network, 6 scripts, 4 source IDs, 29 cookies
  - Notes: none
- https://traderjoes.com/home/store-search
  - Status: ok; HTTP: 200
  - Evidence counts: 16 network, 6 scripts, 4 source IDs, 28 cookies
  - Notes: none
- https://traderjoes.com/home/about-us
  - Status: ok; HTTP: 200
  - Evidence counts: 14 network, 6 scripts, 4 source IDs, 28 cookies
  - Notes: none

### Discovered but Not Scanned

Discovery metadata was not recorded for this report.

### Failed or Partial Pages

No failed or partial pages were recorded.

## Evidence Type Guide

Evidence type describes where the scanner saw a signal. It does not, by itself, prove full implementation, correct configuration, or compliance status.

- **Network evidence:** A browser request to a recognized vendor endpoint was observed during the scan. Limitation: Shows runtime browser activity on the scanned page, but does not by itself prove business rules, consent correctness, or full implementation.
- **Script evidence:** A loaded script URL or third-party script element matched a known vendor rule or contained a known ID. Limitation: Shows that a script was present or requested, but not that every tag inside it fired successfully.
- **Source evidence:** A known ID or signal was found in HTML, inline JavaScript, global previews, or extracted source-level URL text. Limitation: Shows configuration or identifiers in browser-visible source, but not observed firing.
- **Cookie evidence:** Cookies visible to the browser context were captured for a scanned page. Limitation: Cookie names and values can hint at tooling or state, but are not treated as standalone proof of a vendor implementation.
- **Iframe / noscript evidence:** Iframe URLs or noscript blocks exposed known IDs or vendor-related source signals. Limitation: Often reflects fallback or embedded markup; review alongside network and script evidence before drawing conclusions.
- **Global object evidence:** Known browser globals such as data layers or tag-manager objects were present on the page. Limitation: Shows that a page-level object exists, but not that any destination received data.
- **Inferred / rule-match evidence:** A vendor was inferred from source-level IDs, globals, or rule matches rather than a direct observed vendor request. Limitation: Useful for triage, but should be verified before treating it as a confirmed live implementation.

## Detected Vendors by Category

Vendors are grouped by the scanner category attached to each detected rule. These are detected or observed signals, not proof of complete installation.

### Tag Management

- **Adobe Launch**
  - Evidence types: Network evidence, Script evidence
  - IDs: none detected
  - Pages: 5 page(s); first seen: https://traderjoes.com
- **Google Tag Manager**
  - Evidence types: Network evidence, Script evidence, Source evidence
  - IDs: GTM Container ID: GTM-PK37XV6; GTM Container ID: GTM-TZMMWGR
  - Pages: 6 page(s); first seen: https://traderjoes.com

### Analytics

- **Adobe Analytics / Experience Cloud**
  - Evidence types: Network evidence
  - IDs: none detected
  - Pages: 5 page(s); first seen: https://traderjoes.com
- **Google Analytics**
  - Evidence types: Network evidence, Script evidence, Source evidence
  - IDs: GA4 Measurement ID: G-2HMPBJHQ41; UA Property ID: UA-15671700-1; GA4 Measurement ID: G-PVSN19270R; UA Property ID: UA-100422848-1; GA4 Measurement ID: G-2KLNSNQXP1; GA4 Measurement ID: G-Y0LZ6ZMCVR
  - Pages: 6 page(s); first seen: https://traderjoes.com

### Media / Advertising

- **Google Ads / DoubleClick**
  - Evidence types: Network evidence
  - IDs: GA4 Measurement ID: G-PVSN19270R
  - Pages: 1 page(s); first seen: https://locations.traderjoes.com/

## Vendors detected

- **Adobe Launch** (tag_manager) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Google Tag Manager** (tag_manager) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Adobe Analytics / Experience Cloud** (analytics) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Google Analytics** (analytics) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Google Analytics** (analytics) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Google Tag Manager** (tag_manager) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Adobe Launch** (tag_manager) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Google Analytics** (analytics) via source_code - evidence type: Source evidence (inferred) - confidence: medium (65%)
- **Google Tag Manager** (tag_manager) via source_code - evidence type: Source evidence (inferred) - confidence: medium (65%)
- **Google Ads / DoubleClick** (media_pixel) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)

## IDs found

- **GTM Container ID:** `GTM-PK37XV6` - evidence type: Network evidence, Script evidence, Source evidence, Iframe / noscript evidence
- **GA4 Measurement ID:** `G-2HMPBJHQ41` - evidence type: Network evidence, Script evidence, Source evidence
- **UA Property ID:** `UA-15671700-1` - evidence type: Network evidence
- **GA4 Measurement ID:** `G-PVSN19270R` - evidence type: Network evidence, Script evidence, Source evidence
- **GTM Container ID:** `GTM-TZMMWGR` - evidence type: Network evidence, Script evidence, Source evidence, Iframe / noscript evidence
- **UA Property ID:** `UA-100422848-1` - evidence type: Network evidence
- **GA4 Measurement ID:** `G-2KLNSNQXP1` - evidence type: Network evidence, Script evidence, Source evidence
- **GA4 Measurement ID:** `G-Y0LZ6ZMCVR` - evidence type: Network evidence

## Page-level findings

### https://traderjoes.com
- Status: ok
- HTTP status: 200
- Title: Home | Trader Joe's
- Consent clicks: got it
- Network findings: 14
- Third-party scripts: 6
- Cookies captured: 28
- Globals present: dataLayer, adobeDataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 4
  - GTM Container ID: GTM-PK37XV6 (Iframe / noscript evidence)
  - GA4 Measurement ID: G-2HMPBJHQ41 (Source evidence)

### https://locations.traderjoes.com/
- Status: ok
- HTTP status: 200
- Title: Trader Joe's Store Directory | Grocery Store
- Network findings: 10
- Third-party scripts: 4
- Cookies captured: 5
- Globals present: dataLayer, adobeDataLayer
- Google source signals: google_tag_manager, gtag, dataLayer
- Source-derived IDs: 8
  - GTM Container ID: GTM-TZMMWGR (Iframe / noscript evidence)
  - GTM Container ID: GTM-PK37XV6 (Iframe / noscript evidence)
  - GA4 Measurement ID: G-2KLNSNQXP1 (Source evidence)
  - GA4 Measurement ID: G-PVSN19270R (Source evidence)

### https://traderjoes.com/home/products/category/meat-seafood-and-plant-based-122
- Status: ok
- HTTP status: 200
- Title: Meat, Seafood & Plant-based | Trader Joe's
- Consent clicks: got it
- Network findings: 14
- Third-party scripts: 6
- Cookies captured: 29
- Globals present: dataLayer, adobeDataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 4
  - GTM Container ID: GTM-PK37XV6 (Iframe / noscript evidence)
  - GA4 Measurement ID: G-2HMPBJHQ41 (Source evidence)

### https://traderjoes.com/home/products/category/flowers-and-plants-203
- Status: ok
- HTTP status: 200
- Title: Flowers & Plants | Trader Joe's
- Consent clicks: got it
- Network findings: 14
- Third-party scripts: 6
- Cookies captured: 29
- Globals present: dataLayer, adobeDataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 4
  - GTM Container ID: GTM-PK37XV6 (Iframe / noscript evidence)
  - GA4 Measurement ID: G-2HMPBJHQ41 (Source evidence)

### https://traderjoes.com/home/store-search
- Status: ok
- HTTP status: 200
- Title: Store Search | Trader Joe's
- Consent clicks: got it
- Network findings: 16
- Third-party scripts: 6
- Cookies captured: 28
- Globals present: dataLayer, adobeDataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 4
  - GTM Container ID: GTM-PK37XV6 (Iframe / noscript evidence)
  - GA4 Measurement ID: G-2HMPBJHQ41 (Source evidence)

### https://traderjoes.com/home/about-us
- Status: ok
- HTTP status: 200
- Title: About Us | Trader Joe's
- Consent clicks: got it
- Network findings: 14
- Third-party scripts: 6
- Cookies captured: 28
- Globals present: dataLayer, adobeDataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 4
  - GTM Container ID: GTM-PK37XV6 (Iframe / noscript evidence)
  - GA4 Measurement ID: G-2HMPBJHQ41 (Source evidence)

## Caveats

- Each page is scanned in a fresh browser context to reduce cache/state contamination.
- Coverage is limited to the URLs discovered and selected during this run.
- IDs may come from network traffic, script URLs, HTML, inline scripts, iframe URLs, noscript blocks, and request bodies.
- This scanner still only observes what is available through public browser activity.
- It may miss deferred tags, server-side tagging, login-gated tooling, and non-fired rules.

## Recommended Manual Review

Use this checklist to decide what to verify after reviewing the scanner evidence.

- Confirm high-priority conversion paths manually, especially form submits, checkout steps, booking flows, lead events, and post-login experiences that may not be covered by this scan.
- Check whether server-side tagging, backend integrations, or private APIs send data outside browser-visible evidence.
- Confirm important user paths manually because discovery metadata was not recorded for this report.
- Confirm whether consent state changes vendor firing; consent interaction was captured on 5 page(s) in this scan.
- Validate detected IDs against expected GTM containers, GA4 properties, media pixels, CMP settings, and other platform configurations.

### What this scanner does not prove

- It does not inspect GTM account or workspace settings, GA4 property/admin settings, ad platform configurations, CMP admin settings, server-side containers, backend integrations, or private APIs.
- It does not prove that a vendor is absent, fully installed, correctly configured, compliant, or accurately recording conversions.
