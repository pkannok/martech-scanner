const { dedupeBy } = require('../utils');

// Declarative rules own URL-based detection for these vendors. The remaining
// detector branches are intentionally left as specialized/legacy behavior.
const VENDOR_RULES = Object.freeze([
  {
    id: 'google-tag-manager',
    name: 'Google Tag Manager',
    category: 'tag_manager',
    signals: {
      request: [{ hosts: ['googletagmanager.com'], paths: [/^\/gtm\.js$/, /^\/gtm\//, /^\/ns\.html$/] }],
      script: [{ hosts: ['googletagmanager.com'], paths: [/^\/gtm\.js$/, /^\/gtm\//] }],
      iframe: [{ hosts: ['googletagmanager.com'], paths: [/^\/ns\.html$/] }],
    },
  },
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    category: 'analytics',
    signals: {
      request: [
        { hosts: ['google-analytics.com', 'analytics.google.com'], paths: [/\/collect/, /\/g\/collect/, /\/mp\/collect/] },
      ],
      script: [{ hosts: ['googletagmanager.com'], paths: [/^\/gtag\/js$/], search: [/[?&]id=g-[a-z0-9]+/i] }],
    },
  },
  {
    id: 'meta-pixel',
    name: 'Meta Pixel',
    category: 'media_pixel',
    signals: {
      request: [{ hosts: ['facebook.com'], paths: [/^\/tr$/] }],
      script: [{ hosts: ['connect.facebook.net'] }],
    },
  },
  {
    id: 'tiktok-pixel',
    name: 'TikTok Pixel',
    category: 'media_pixel',
    signals: {
      request: [{ hosts: ['analytics.tiktok.com', 'business-api.tiktok.com'] }],
      script: [{ hosts: ['analytics.tiktok.com', 'tiktokcdn.com'] }],
    },
  },
  {
    id: 'adobe-experience-cloud',
    name: 'Adobe Analytics / Experience Cloud',
    category: 'analytics',
    signals: {
      request: [{ hosts: ['omtrdc.net', '2o7.net', 'demdex.net', 'adobedc.net', 'everesttech.net'] }],
      script: [{ hosts: ['omtrdc.net', '2o7.net', 'demdex.net', 'adobedc.net', 'everesttech.net'] }],
    },
  },
  {
    id: 'adobe-target',
    name: 'Adobe Target',
    category: 'experimentation',
    signals: {
      cookies: [
        { type: 'exact', name: 'mbox', strength: 'primary' },
        { type: 'exact', name: 'at_check', strength: 'supporting' },
        { type: 'exact', name: 'mboxEdgeCluster', strength: 'supporting' },
      ],
    },
  },
  {
    id: 'hotjar',
    name: 'Hotjar',
    category: 'session_replay',
    signals: {
      cookies: [
        { type: 'prefix', value: '_hjSessionUser_', strength: 'primary' },
        { type: 'prefix', value: '_hjSession_', strength: 'primary' },
        { type: 'exact', name: '_hjHasCachedUserAttributes', strength: 'supporting' },
        { type: 'exact', name: '_hjUserAttributesHash', strength: 'supporting' },
      ],
    },
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'customer_data_platform',
    signals: {
      globals: [{ path: '_hsq', types: ['array'], strength: 'primary' }],
      cookies: [
        { type: 'exact', name: 'hubspotutk', strength: 'primary' },
        { type: 'exact', name: '__hstc', strength: 'primary' },
        { type: 'exact', name: '__hssc', strength: 'primary' },
        { type: 'exact', name: '__hssrc', strength: 'primary' },
      ],
    },
  },
  {
    id: 'fullstory',
    name: 'FullStory',
    category: 'session_replay',
    signals: {
      globals: [{ path: 'FS', types: ['function', 'object'], strength: 'primary' }],
      cookies: [
        { type: 'exact', name: 'fs_uid', strength: 'primary' },
        { type: 'exact', name: 'fs_cid', strength: 'primary' },
        { type: 'exact', name: 'fs_lua', strength: 'primary' },
      ],
    },
  },
  {
    id: 'tealium',
    name: 'Tealium',
    category: 'tag_manager',
    signals: { globals: [{ path: 'utag', types: ['object', 'function'], strength: 'primary' }] },
  },
  {
    id: 'optimizely',
    name: 'Optimizely',
    category: 'experimentation',
    signals: { globals: [{ path: 'optimizely', types: ['object', 'function'], strength: 'primary' }] },
  },
]);

const RULE_BY_NAME = new Map(VENDOR_RULES.map(rule => [rule.name, rule]));

function hostMatches(hostname, expectedHost) {
  return hostname === expectedHost || hostname.endsWith(`.${expectedHost}`);
}

function ruleSignalMatches(signal, url) {
  if (!signal.hosts?.some(host => hostMatches(url.hostname, host))) return false;
  if (signal.paths?.length && !signal.paths.some(pattern => pattern.test(url.pathname))) return false;
  if (signal.search?.length && !signal.search.some(pattern => pattern.test(url.search))) return false;
  return true;
}

function evaluateVendorRules(text, options = {}) {
  if (!text || typeof text !== 'string') return [];

  let url;
  try {
    url = new URL(text);
  } catch {
    return [];
  }

  const source = options.source || null;
  return VENDOR_RULES.filter(rule => {
    const signalGroups = source ? rule.signals?.[source] || [] : Object.values(rule.signals || {}).flat();
    return signalGroups.some(signal => ruleSignalMatches(signal, url));
  });
}

function cookieRuleMatches(cookieName, signal) {
  if (!cookieName || !signal) return false;
  if (signal.type === 'exact') return cookieName === signal.name;
  if (signal.type === 'prefix') return cookieName.startsWith(signal.value);
  if (signal.type === 'regex' && signal.pattern instanceof RegExp) return signal.pattern.test(cookieName);
  return false;
}

function evaluateCookieRules(cookies) {
  const names = new Set((cookies || []).map(cookie => cookie?.name).filter(Boolean));
  return VENDOR_RULES
    .filter(rule => (rule.signals?.cookies || []).some(signal =>
      signal.strength !== 'supporting' && [...names].some(name => cookieRuleMatches(name, signal))
    ))
    .map(rule => ({
      rule,
      cookieNames: [...names].filter(name => (rule.signals?.cookies || []).some(signal => cookieRuleMatches(name, signal))),
    }));
}

function evaluateGlobalRules(runtimeSignals) {
  const observed = new Map((runtimeSignals || [])
    .filter(signal => signal?.path && signal.exists && signal.typeAllowed !== false)
    .map(signal => [signal.path, signal]));

  return VENDOR_RULES
    .filter(rule => (rule.signals?.globals || []).some(signal => {
      const runtime = observed.get(signal.path);
      return signal.strength !== 'supporting' && runtime && (!signal.types?.length || signal.types.includes(runtime.type));
    }))
    .map(rule => ({
      rule,
      paths: (rule.signals?.globals || []).filter(signal => observed.has(signal.path)).map(signal => signal.path),
    }));
}

function vendorIdForName(name) {
  return RULE_BY_NAME.get(name)?.id || null;
}

function vendorNameForId(id) {
  return VENDOR_RULES.find(rule => rule.id === id)?.name || null;
}

function dedupeRuleMatches(matches) {
  return dedupeBy(matches, rule => rule.id);
}

module.exports = {
  VENDOR_RULES,
  evaluateVendorRules,
  evaluateCookieRules,
  evaluateGlobalRules,
  cookieRuleMatches,
  dedupeRuleMatches,
  vendorIdForName,
  vendorNameForId,
};
