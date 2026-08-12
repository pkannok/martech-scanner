# Vendor-rule architecture

The scanner uses a hybrid detection model:

```text
browser/source observations
        ↓
normalized URLs, scripts, requests, and IDs
        ↓
declarative vendor rules + legacy/custom detectors
        ↓
existing vendor/evidence result structures
        ↓
reporting and quality evaluation
```

## Rule schema

Declarative rules live in `src/detection/vendorRules.js` and have stable internal IDs, display names, categories, and explicit source-scoped signals:

```js
{
  id: 'google-analytics',
  name: 'Google Analytics',
  category: 'analytics',
  signals: {
    request: [{ hosts: ['google-analytics.com'], paths: [/\\/collect/] }],
    script: [{ hosts: ['googletagmanager.com'], paths: [/^\\/gtag\\/js$/], search: [/[?&]id=g-/i] }]
  }
}
```

Hosts are matched by exact hostname or subdomain. Paths and query patterns are evaluated only after the host context matches. This prevents a generic word or identifier from acting as a vendor detection on an unrelated site.

## Adding an ordinary vendor

1. Add a lowercase stable ID, display name, category, and source-specific signals to `VENDOR_RULES`.
2. Keep signals scoped to the request, script, or iframe context where they are valid.
3. Add positive and negative cases to `test/vendor-rules.test.js`.
4. Add or extend a quality scenario in `test/quality/scenarios.json` using the stable ID.
5. Run `npm run test:quality` and `npm test`.

## When to use a custom detector

Use a specialized detector when a vendor requires compound state, unusual payload parsing, multi-step interpretation, custom ID extraction, or behavior that cannot be expressed as source-scoped host/path/query signals. Legacy detectors remain supported for non-migrated vendors.

## Unsafe rules

Avoid contextless rules such as `/analytics/` or broad short-ID patterns. Shared CDNs, common path names, generic query parameters, and short identifiers require a vendor-specific host or stronger primary signal. A supporting identifier should strengthen an existing candidate, not create an unconditional detection by itself.

Stable IDs are internal at this stage; public scan results retain their existing display-name-based shape for compatibility.
