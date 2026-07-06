# MarTech Scan Summary

- **Scanner version:** 0.3.0
- **Report template version:** 2.7
- **Domain:** https://beckons.com
- **Scanned at:** 2026-04-21T20:07:38.779Z
- **Pages scanned:** 6
- **Max pages configured:** 6
- **Consent click enabled:** true

## Executive Summary

- Target: https://beckons.com
- Generated at: 2026-04-21T20:07:38.779Z
- Pages scanned: 6
- Failed pages: 0
- Vendors detected: 22
- IDs detected: 8
- Consent interaction: Enabled; no consent interaction was captured.
- Thin / low-evidence pages: 0

This report reflects browser-visible evidence from the scanned pages only and should be reviewed by an analyst before being treated as complete.

## Scan Coverage

Coverage is limited to the URLs discovered and selected during this run.

- Seed / target: https://beckons.com
- Total pages scanned: 6
- Total URLs discovered: not recorded
- Discovered but not scanned: not recorded
- Failed pages: 0
- Thin / low-evidence pages: 0

### Scanned Pages

- https://beckons.com
  - Status: ok; HTTP: 200
  - Evidence counts: 158 network, 13 scripts, 11 source IDs, 15 cookies
  - Notes: none
- https://beckons.com/
  - Status: ok; HTTP: 200
  - Evidence counts: 158 network, 13 scripts, 11 source IDs, 15 cookies
  - Notes: none
- https://beckons.com/#about
  - Status: ok; HTTP: 200
  - Evidence counts: 170 network, 14 scripts, 10 source IDs, 15 cookies
  - Notes: none
- https://beckons.com/#lodges
  - Status: ok; HTTP: 200
  - Evidence counts: 167 network, 13 scripts, 10 source IDs, 15 cookies
  - Notes: none
- https://beckons.com/about/
  - Status: ok; HTTP: 200
  - Evidence counts: 108 network, 13 scripts, 11 source IDs, 15 cookies
  - Notes: none
- https://beckons.com/contact-us/
  - Status: ok; HTTP: 200
  - Evidence counts: 95 network, 13 scripts, 11 source IDs, 16 cookies
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
  - IDs: GTM Container ID: GTM-PC3TL92D
  - Pages: 6 page(s); first seen: https://beckons.com

### Analytics

- **Adobe Analytics / Experience Cloud**
  - Evidence types: Network evidence
  - IDs: none detected
  - Pages: 6 page(s); first seen: https://beckons.com
- **Google Analytics**
  - Evidence types: Network evidence, Script evidence, Source evidence
  - IDs: GA4 Measurement ID: G-G5Y3RBXDG8
  - Pages: 6 page(s); first seen: https://beckons.com

### Media / Advertising

- **Google Ads / DoubleClick**
  - Evidence types: Network evidence, Script evidence, Source evidence
  - IDs: Google Ads ID: AW-17911345596; GA4 Measurement ID: G-G5Y3RBXDG8; DoubleClick Advertiser ID: DC-16510922
  - Pages: 6 page(s); first seen: https://beckons.com
- **Meta Pixel**
  - Evidence types: Network evidence, Script evidence, Source evidence
  - IDs: Facebook Pixel ID: 633710700486705
  - Pages: 6 page(s); first seen: https://beckons.com
- **The Trade Desk**
  - Evidence types: Network evidence, Script evidence, Source evidence
  - IDs: The Trade Desk Advertiser ID: fypp50u; The Trade Desk Advertiser ID: aam
  - Pages: 6 page(s); first seen: https://beckons.com
- **TikTok Pixel**
  - Evidence types: Network evidence, Script evidence, Source evidence
  - IDs: TikTok Pixel ID: D4T4CDJC77U9L5PIV3O0
  - Pages: 6 page(s); first seen: https://beckons.com

### Ecommerce / Platform

- **WordPress**
  - Evidence types: Network evidence
  - IDs: none detected
  - Pages: 6 page(s); first seen: https://beckons.com

### Personalization / Experimentation

- **Hotjar**
  - Evidence types: Network evidence, Script evidence
  - IDs: none detected
  - Pages: 6 page(s); first seen: https://beckons.com

## Vendors detected

- **WordPress** (cms) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Google Tag Manager** (tag_manager) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Meta Pixel** (media_pixel) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Google Analytics** (analytics) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Google Ads / DoubleClick** (media_pixel) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Hotjar** (session_replay) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **TikTok Pixel** (media_pixel) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **The Trade Desk** (media_pixel) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **Adobe Analytics / Experience Cloud** (analytics) via network - evidence type: Network evidence (observed firing) - confidence: high (95%)
- **TikTok Pixel** (media_pixel) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Hotjar** (session_replay) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Google Ads / DoubleClick** (media_pixel) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Google Analytics** (analytics) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Meta Pixel** (media_pixel) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Google Tag Manager** (tag_manager) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **The Trade Desk** (media_pixel) via script - evidence type: Script evidence (present in source) - confidence: high (85%)
- **Google Analytics** (analytics) via source_code - evidence type: Source evidence (inferred) - confidence: medium (65%)
- **Google Ads / DoubleClick** (media_pixel) via source_code - evidence type: Source evidence (inferred) - confidence: medium (65%)
- **Meta Pixel** (media_pixel) via source_code - evidence type: Source evidence (inferred) - confidence: medium (65%)
- **TikTok Pixel** (media_pixel) via source_code - evidence type: Source evidence (inferred) - confidence: medium (65%)
- **The Trade Desk** (media_pixel) via source_code - evidence type: Source evidence (inferred) - confidence: medium (65%)
- **Google Tag Manager** (tag_manager) via source_code - evidence type: Source evidence (inferred) - confidence: medium (65%)

## IDs found

- **GTM Container ID:** `GTM-PC3TL92D` - evidence type: Network evidence, Script evidence, Source evidence, Iframe / noscript evidence
- **GA4 Measurement ID:** `G-G5Y3RBXDG8` - evidence type: Network evidence, Script evidence, Source evidence
- **Google Ads ID:** `AW-17911345596` - evidence type: Network evidence, Script evidence, Source evidence
- **TikTok Pixel ID:** `D4T4CDJC77U9L5PIV3O0` - evidence type: Network evidence, Script evidence, Source evidence
- **The Trade Desk Advertiser ID:** `fypp50u` - evidence type: Network evidence, Source evidence
- **The Trade Desk Advertiser ID:** `aam` - evidence type: Network evidence
- **DoubleClick Advertiser ID:** `DC-16510922` - evidence type: Script evidence, Source evidence
- **Facebook Pixel ID:** `633710700486705` - evidence type: Source evidence, Iframe / noscript evidence

## Page-level findings

### https://beckons.com
- Status: ok
- HTTP status: 200
- Title: Beckons - Luxury Lodges & Exclusive Travel Experiences
- Network findings: 158
- Third-party scripts: 13
- Cookies captured: 15
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 11
  - GTM Container ID: GTM-PC3TL92D (Iframe / noscript evidence)
  - Facebook Pixel ID: 633710700486705 (Iframe / noscript evidence)
  - GA4 Measurement ID: G-G5Y3RBXDG8 (Source evidence)
  - Google Ads ID: AW-17911345596 (Source evidence)
  - DoubleClick Advertiser ID: DC-16510922 (Source evidence)
  - TikTok Pixel ID: D4T4CDJC77U9L5PIV3O0 (Source evidence)
  - The Trade Desk Advertiser ID: fypp50u (Source evidence)

### https://beckons.com/
- Status: ok
- HTTP status: 200
- Title: Beckons - Luxury Lodges & Exclusive Travel Experiences
- Network findings: 158
- Third-party scripts: 13
- Cookies captured: 15
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 11
  - GTM Container ID: GTM-PC3TL92D (Iframe / noscript evidence)
  - Facebook Pixel ID: 633710700486705 (Iframe / noscript evidence)
  - GA4 Measurement ID: G-G5Y3RBXDG8 (Source evidence)
  - Google Ads ID: AW-17911345596 (Source evidence)
  - DoubleClick Advertiser ID: DC-16510922 (Source evidence)
  - TikTok Pixel ID: D4T4CDJC77U9L5PIV3O0 (Source evidence)
  - The Trade Desk Advertiser ID: fypp50u (Source evidence)

### https://beckons.com/#about
- Status: ok
- HTTP status: 200
- Title: Beckons - Luxury Lodges & Exclusive Travel Experiences
- Network findings: 170
- Third-party scripts: 14
- Cookies captured: 15
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 10
  - GTM Container ID: GTM-PC3TL92D (Iframe / noscript evidence)
  - GA4 Measurement ID: G-G5Y3RBXDG8 (Source evidence)
  - Google Ads ID: AW-17911345596 (Source evidence)
  - DoubleClick Advertiser ID: DC-16510922 (Source evidence)
  - Facebook Pixel ID: 633710700486705 (Iframe / noscript evidence)
  - TikTok Pixel ID: D4T4CDJC77U9L5PIV3O0 (Source evidence)
  - The Trade Desk Advertiser ID: fypp50u (Source evidence)

### https://beckons.com/#lodges
- Status: ok
- HTTP status: 200
- Title: Beckons - Luxury Lodges & Exclusive Travel Experiences
- Network findings: 167
- Third-party scripts: 13
- Cookies captured: 15
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 10
  - GTM Container ID: GTM-PC3TL92D (Iframe / noscript evidence)
  - GA4 Measurement ID: G-G5Y3RBXDG8 (Source evidence)
  - Google Ads ID: AW-17911345596 (Source evidence)
  - DoubleClick Advertiser ID: DC-16510922 (Source evidence)
  - Facebook Pixel ID: 633710700486705 (Iframe / noscript evidence)
  - TikTok Pixel ID: D4T4CDJC77U9L5PIV3O0 (Source evidence)
  - The Trade Desk Advertiser ID: fypp50u (Source evidence)

### https://beckons.com/about/
- Status: ok
- HTTP status: 200
- Title: About Our Collection of Luxury Wilderness Lodges | Beckons
- Network findings: 108
- Third-party scripts: 13
- Cookies captured: 15
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 11
  - GTM Container ID: GTM-PC3TL92D (Iframe / noscript evidence)
  - Facebook Pixel ID: 633710700486705 (Iframe / noscript evidence)
  - GA4 Measurement ID: G-G5Y3RBXDG8 (Source evidence)
  - Google Ads ID: AW-17911345596 (Source evidence)
  - DoubleClick Advertiser ID: DC-16510922 (Source evidence)
  - TikTok Pixel ID: D4T4CDJC77U9L5PIV3O0 (Source evidence)
  - The Trade Desk Advertiser ID: fypp50u (Source evidence)

### https://beckons.com/contact-us/
- Status: ok
- HTTP status: 200
- Title: Contact Our Travel Specialists | Beckons
- Network findings: 95
- Third-party scripts: 13
- Cookies captured: 16
- Globals present: dataLayer
- Google source signals: google_tag_manager, dataLayer
- Source-derived IDs: 11
  - GTM Container ID: GTM-PC3TL92D (Iframe / noscript evidence)
  - Facebook Pixel ID: 633710700486705 (Iframe / noscript evidence)
  - GA4 Measurement ID: G-G5Y3RBXDG8 (Source evidence)
  - Google Ads ID: AW-17911345596 (Source evidence)
  - DoubleClick Advertiser ID: DC-16510922 (Source evidence)
  - TikTok Pixel ID: D4T4CDJC77U9L5PIV3O0 (Source evidence)
  - The Trade Desk Advertiser ID: fypp50u (Source evidence)

## Caveats

- Each page is scanned in a fresh browser context to reduce cache/state contamination.
- Coverage is limited to the URLs discovered and selected during this run.
- IDs may come from network traffic, script URLs, HTML, inline scripts, iframe URLs, noscript blocks, and request bodies.
- This scanner still only observes what is available through public browser activity.
- It may miss deferred tags, server-side tagging, login-gated tooling, and non-fired rules.
