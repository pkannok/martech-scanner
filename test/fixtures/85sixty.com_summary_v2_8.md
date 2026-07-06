# MarTech Scan Summary

- **Scanner version:** 0.3.0
- **Report template version:** 2.8
- **Domain:** https://85sixty.com
- **Scanned at:** 2026-03-18T23:46:05.630Z
- **Pages scanned:** 6
- **Max pages configured:** 6
- **Consent click enabled:** true

## Executive Summary

- Target: https://85sixty.com
- Generated at: 2026-03-18T23:46:05.630Z
- Pages scanned: 6
- Failed pages: 0
- Vendors detected: 11
- IDs detected: 3
- Consent interaction: Enabled; no consent interaction was captured.
- Thin / low-evidence pages: 0

This report reflects browser-visible evidence from the scanned pages only and should be reviewed by an analyst before being treated as complete.

## Scan Coverage

Coverage is limited to the URLs discovered and selected during this run.

- Seed / target: https://85sixty.com
- Total pages scanned: 6
- Total URLs discovered: not recorded
- Discovered but not scanned: not recorded
- Failed pages: 0
- Thin / low-evidence pages: 0

### Scanned Pages

- https://85sixty.com
  - Status: ok; HTTP: 200
  - Evidence counts: 38 network, 3 scripts, 5 source IDs, 4 cookies
  - Notes: none
- https://www.85sixty.com/
  - Status: ok; HTTP: 200
  - Evidence counts: 38 network, 3 scripts, 5 source IDs, 4 cookies
  - Notes: none
- https://www.85sixty.com/shopify-plus-agency-partner/
  - Status: ok; HTTP: 200
  - Evidence counts: 131 network, 4 scripts, 5 source IDs, 9 cookies
  - Notes: none
- https://www.85sixty.com/about/
  - Status: ok; HTTP: 200
  - Evidence counts: 40 network, 3 scripts, 5 source IDs, 4 cookies
  - Notes: none
- https://www.85sixty.com/contact/
  - Status: ok; HTTP: 200
  - Evidence counts: 86 network, 4 scripts, 5 source IDs, 9 cookies
  - Notes: none
- https://www.85sixty.com/services/media-strategy-planning-buying/
  - Status: ok; HTTP: 200
  - Evidence counts: 115 network, 4 scripts, 5 source IDs, 9 cookies
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

- **Google Tag Manager**
  - Evidence types: Network evidence, Script evidence, Source evidence
  - IDs: GTM Container ID: GTM-PLSL6GS
  - Pages: 6 page(s); first seen: https://85sixty.com

### Analytics

- **Adobe Analytics / Experience Cloud**
  - Evidence types: Network evidence
  - IDs: none detected
  - Pages: 3 page(s); first seen: https://www.85sixty.com/shopify-plus-agency-partner/
- **Google Analytics**
  - Evidence types: Script evidence, Source evidence, Network evidence
  - IDs: GA4 Measurement ID: G-CYPTKEVWNP
  - Pages: 6 page(s); first seen: https://85sixty.com

### Media / Advertising

- **Google Ads / DoubleClick**
  - Evidence types: Script evidence, Source evidence, Network evidence
  - IDs: Google Ads ID: AW-986765357
  - Pages: 6 page(s); first seen: https://85sixty.com

### Ecommerce / Platform

- **WordPress**
  - Evidence types: Network evidence
  - IDs: none detected
  - Pages: 6 page(s); first seen: https://85sixty.com

## Vendors detected

- **Google Tag Manager** (tag_manager) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **WordPress** (cms) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Google Analytics** (analytics) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Google Ads / DoubleClick** (media_pixel) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Google Tag Manager** (tag_manager) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Google Analytics** (analytics) via source_code - evidence type: Source evidence (inferred) - confidence: medium (65%)
- **Google Ads / DoubleClick** (media_pixel) via source_code - evidence type: Source evidence (inferred) - confidence: medium (65%)
- **Google Tag Manager** (tag_manager) via source_code - evidence type: Source evidence (inferred) - confidence: medium (65%)
- **Google Ads / DoubleClick** (media_pixel) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Google Analytics** (analytics) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Adobe Analytics / Experience Cloud** (analytics) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)

## IDs found

- **GTM Container ID:** `GTM-PLSL6GS` - evidence type: Network evidence, Script evidence, Source evidence, Iframe / noscript evidence
- **GA4 Measurement ID:** `G-CYPTKEVWNP` - evidence type: Script evidence, Source evidence, Network evidence
- **Google Ads ID:** `AW-986765357` - evidence type: Script evidence, Source evidence, Network evidence

## Page-level findings

### https://85sixty.com
- Status: ok
- HTTP status: 200
- Title: Digital Marketing Agency - Integrated & AI-Driven Growth
- Network findings: 38
- Third-party scripts: 3
- Cookies captured: 4
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 5
  - GTM Container ID: GTM-PLSL6GS (Iframe / noscript evidence)
  - GA4 Measurement ID: G-CYPTKEVWNP (Source evidence)
  - Google Ads ID: AW-986765357 (Source evidence)

### https://www.85sixty.com/
- Status: ok
- HTTP status: 200
- Title: Digital Marketing Agency - Integrated & AI-Driven Growth
- Network findings: 38
- Third-party scripts: 3
- Cookies captured: 4
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 5
  - GTM Container ID: GTM-PLSL6GS (Iframe / noscript evidence)
  - GA4 Measurement ID: G-CYPTKEVWNP (Source evidence)
  - Google Ads ID: AW-986765357 (Source evidence)

### https://www.85sixty.com/shopify-plus-agency-partner/
- Status: ok
- HTTP status: 200
- Title: Shopify Development Agency | Custom Shopify Design - 85SIXTY
- Network findings: 131
- Third-party scripts: 4
- Cookies captured: 9
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 5
  - GTM Container ID: GTM-PLSL6GS (Iframe / noscript evidence)
  - GA4 Measurement ID: G-CYPTKEVWNP (Source evidence)
  - Google Ads ID: AW-986765357 (Source evidence)

### https://www.85sixty.com/about/
- Status: ok
- HTTP status: 200
- Title: Our Story - Digital Consulting Agency - 85SIXTY
- Network findings: 40
- Third-party scripts: 3
- Cookies captured: 4
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 5
  - GTM Container ID: GTM-PLSL6GS (Iframe / noscript evidence)
  - GA4 Measurement ID: G-CYPTKEVWNP (Source evidence)
  - Google Ads ID: AW-986765357 (Source evidence)

### https://www.85sixty.com/contact/
- Status: ok
- HTTP status: 200
- Title: Contact Our Digital Marketing Agency - 85SIXTY
- Network findings: 86
- Third-party scripts: 4
- Cookies captured: 9
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 5
  - GTM Container ID: GTM-PLSL6GS (Iframe / noscript evidence)
  - GA4 Measurement ID: G-CYPTKEVWNP (Source evidence)
  - Google Ads ID: AW-986765357 (Source evidence)

### https://www.85sixty.com/services/media-strategy-planning-buying/
- Status: ok
- HTTP status: 200
- Title: Digital Advertising Agency Partner - TikTok, Meta, Google Ad Agency - 85SIXTY
- Network findings: 115
- Third-party scripts: 4
- Cookies captured: 9
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 5
  - GTM Container ID: GTM-PLSL6GS (Iframe / noscript evidence)
  - GA4 Measurement ID: G-CYPTKEVWNP (Source evidence)
  - Google Ads ID: AW-986765357 (Source evidence)

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
- Confirm whether consent state changes vendor firing; no consent interaction was captured in this scan.
- Validate detected IDs against expected GTM containers, GA4 properties, media pixels, CMP settings, and other platform configurations.

### What this scanner does not prove

- It does not inspect GTM account or workspace settings, GA4 property/admin settings, ad platform configurations, CMP admin settings, server-side containers, backend integrations, or private APIs.
- It does not prove that a vendor is absent, fully installed, correctly configured, compliant, or accurately recording conversions.
