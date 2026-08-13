const { summarizeVendors } = require('../../src/reporting');
const { vendorIdForName, vendorNameForId } = require('../../src/detection/vendorRules');

function vendorEvidenceTypes(vendor) {
  const evidenceType = vendor.evidence?.type;
  if (vendor.source === 'network' || evidenceType === 'observed_firing') return 'network';
  if (vendor.source === 'script' || evidenceType === 'present_in_source') return 'script';
  if (vendor.source === 'source_code' || evidenceType === 'inferred') return 'source';
  if (vendor.source === 'global') return 'global';
  return vendor.source || evidenceType || 'unknown';
}

function collectDetectedVendors(report) {
  const detected = new Map();

  for (const vendor of summarizeVendors([report])) {
    const id = vendorIdForName(vendor.name) || vendor.name;
    if (!detected.has(id)) detected.set(id, { name: vendor.name, evidence: new Set(), identifiers: new Set() });
    const current = detected.get(id);
    current.evidence.add(vendorEvidenceTypes(vendor));
    for (const identifier of vendor.evidence?.ids || []) current.identifiers.add(identifier.value);
  }

  const addIdentifiers = (vendorName, ids) => {
    const id = vendorIdForName(vendorName) || vendorName;
    if (!detected.has(id)) detected.set(id, { name: vendorName, evidence: new Set(), identifiers: new Set() });
    for (const identifier of ids || []) detected.get(id).identifiers.add(identifier.value);
  };

  for (const finding of report.networkFindings || []) addIdentifiers(finding.vendor?.name, finding.ids);
  for (const script of report.scriptFindings || []) {
    for (const vendor of script.detectedVendors || []) addIdentifiers(vendor.name, script.ids);
  }
  const sourceIdentifierVendors = {
    'GA4 Measurement ID': 'Google Analytics',
    'GTM Container ID': 'Google Tag Manager',
    'Facebook Pixel ID': 'Meta Pixel',
    'The Trade Desk Advertiser ID': 'The Trade Desk',
  };
  for (const ids of [report.sourceSignals?.htmlIds, report.sourceSignals?.inlineScriptIds, report.sourceSignals?.noscriptIds]) {
    for (const identifier of ids || []) {
      if (sourceIdentifierVendors[identifier.type]) addIdentifiers(sourceIdentifierVendors[identifier.type], [identifier]);
    }
  }

  return detected;
}

function sortValues(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function evaluateScenario(scenario, report) {
  const detected = collectDetectedVendors(report);
  const expected = new Set(scenario.expectedVendors || []);
  const explicitlyAbsent = new Set(scenario.expectedAbsentVendors || []);
  const missed = sortValues([...expected].filter(vendor => !detected.has(vendor)));
  const unexpected = sortValues([...detected.keys()].filter(vendor => !expected.has(vendor)));
  const evidenceMisses = [];
  const identifierMisses = [];
  const firstObserved = new Map();
  for (const item of report.diagnostics?.observation?.firstObserved || []) {
    if (item.vendor && !firstObserved.has(item.vendor)) firstObserved.set(item.vendor, item.phase);
  }

  for (const [vendor, expectedEvidence] of Object.entries(scenario.expectedEvidence || {})) {
    const observedEvidence = detected.get(vendor)?.evidence || new Set();
    const missingEvidence = sortValues(expectedEvidence.filter(type => !observedEvidence.has(type)));
    if (missingEvidence.length) {
      evidenceMisses.push({
        vendor,
        expected: sortValues(expectedEvidence),
        observed: sortValues(observedEvidence),
        missing: missingEvidence,
      });
    }
  }

  for (const [vendor, expectedIdentifiers] of Object.entries(scenario.expectedIdentifiers || {})) {
    const observed = detected.get(vendor)?.identifiers || new Set();
    const missing = sortValues(expectedIdentifiers.filter(identifier => !observed.has(identifier)));
    if (missing.length) identifierMisses.push({ vendor, expected: sortValues(expectedIdentifiers), observed: sortValues(observed), missing });
  }

  const observationMisses = [];
  for (const [vendor, expectedPhase] of Object.entries(scenario.expectedFirstObserved || {})) {
    if (firstObserved.get(vendor) !== expectedPhase) {
      observationMisses.push({ vendor, expected: expectedPhase, observed: firstObserved.get(vendor) || '(none)' });
    }
  }

  return {
    scenario: scenario.name,
    architecture: scenario.architecture,
    passed: missed.length === 0 && unexpected.length === 0 && evidenceMisses.length === 0 && identifierMisses.length === 0 && observationMisses.length === 0,
    expected: sortValues(expected),
    detected: sortValues(detected.keys()),
    missed,
    unexpected,
    explicitlyAbsent: sortValues(explicitlyAbsent),
    evidenceMisses,
    identifierMisses,
    observationMisses,
    report,
  };
}

function formatScenarioFailure(result) {
  const label = id => vendorNameForId(id) ? `${id} (${vendorNameForId(id)})` : id;
  const lines = [
    `Scenario: ${result.scenario}`,
    `Architecture: ${result.architecture}`,
    '',
    'Expected vendors:',
    ...(result.expected.length ? result.expected.map(vendor => `  ${label(vendor)}`) : ['  (none)']),
    '',
    'Detected vendors:',
    ...(result.detected.length ? result.detected.map(vendor => `  ${label(vendor)}`) : ['  (none)']),
  ];

  if (result.missed.length) {
    lines.push('', 'Missed:', ...result.missed.map(vendor => `  ${label(vendor)}`));
  }
  if (result.unexpected.length) {
    lines.push('', 'Unexpected:', ...result.unexpected.map(vendor => `  ${label(vendor)}`));
  }
  if (result.evidenceMisses.length) {
    lines.push('', 'Evidence gaps:');
    for (const gap of result.evidenceMisses) {
      lines.push(`  ${label(gap.vendor)}`, `    Expected: ${gap.expected.join(', ')}`, `    Observed: ${gap.observed.length ? gap.observed.join(', ') : '(none)'}`);
    }
  }
  if (result.identifierMisses.length) {
    lines.push('', 'Identifier gaps:');
    for (const gap of result.identifierMisses) {
      lines.push(`  ${label(gap.vendor)}`, `    Expected: ${gap.expected.join(', ')}`, `    Observed: ${gap.observed.length ? gap.observed.join(', ') : '(none)'}`);
    }
  }
  if (result.observationMisses.length) {
    lines.push('', 'Observation gaps:');
    for (const gap of result.observationMisses) lines.push(`  ${label(gap.vendor)}`, `    Expected first observed: ${gap.expected}`, `    Observed: ${gap.observed}`);
  }

  return lines.join('\n');
}

module.exports = {
  collectDetectedVendors,
  evaluateScenario,
  formatScenarioFailure,
};
