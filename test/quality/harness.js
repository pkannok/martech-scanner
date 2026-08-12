const { summarizeVendors } = require('../../src/reporting');

function vendorEvidenceTypes(vendor) {
  const evidenceType = vendor.evidence?.type;
  if (vendor.source === 'network' || evidenceType === 'observed_firing') return 'network';
  if (vendor.source === 'script' || evidenceType === 'present_in_source') return 'script';
  if (vendor.source === 'source_code' || evidenceType === 'inferred') return 'source';
  return vendor.source || evidenceType || 'unknown';
}

function collectDetectedVendors(report) {
  const detected = new Map();

  for (const vendor of summarizeVendors([report])) {
    if (!detected.has(vendor.name)) detected.set(vendor.name, new Set());
    detected.get(vendor.name).add(vendorEvidenceTypes(vendor));
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

  for (const [vendor, expectedEvidence] of Object.entries(scenario.expectedEvidence || {})) {
    const observedEvidence = detected.get(vendor) || new Set();
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

  return {
    scenario: scenario.name,
    architecture: scenario.architecture,
    passed: missed.length === 0 && unexpected.length === 0 && evidenceMisses.length === 0,
    expected: sortValues(expected),
    detected: sortValues(detected.keys()),
    missed,
    unexpected,
    explicitlyAbsent: sortValues(explicitlyAbsent),
    evidenceMisses,
    report,
  };
}

function formatScenarioFailure(result) {
  const lines = [
    `Scenario: ${result.scenario}`,
    `Architecture: ${result.architecture}`,
    '',
    'Expected vendors:',
    ...(result.expected.length ? result.expected.map(vendor => `  ${vendor}`) : ['  (none)']),
    '',
    'Detected vendors:',
    ...(result.detected.length ? result.detected.map(vendor => `  ${vendor}`) : ['  (none)']),
  ];

  if (result.missed.length) {
    lines.push('', 'Missed:', ...result.missed.map(vendor => `  ${vendor}`));
  }
  if (result.unexpected.length) {
    lines.push('', 'Unexpected:', ...result.unexpected.map(vendor => `  ${vendor}`));
  }
  if (result.evidenceMisses.length) {
    lines.push('', 'Evidence gaps:');
    for (const gap of result.evidenceMisses) {
      lines.push(`  ${gap.vendor}`, `    Expected: ${gap.expected.join(', ')}`, `    Observed: ${gap.observed.length ? gap.observed.join(', ') : '(none)'}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  collectDetectedVendors,
  evaluateScenario,
  formatScenarioFailure,
};
