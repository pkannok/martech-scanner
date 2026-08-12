const { summarizeVendors } = require('../../src/reporting');
const { vendorIdForName, vendorNameForId } = require('../../src/detection/vendorRules');

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
    const id = vendorIdForName(vendor.name) || vendor.name;
    if (!detected.has(id)) detected.set(id, { name: vendor.name, evidence: new Set() });
    detected.get(id).evidence.add(vendorEvidenceTypes(vendor));
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

  return lines.join('\n');
}

module.exports = {
  collectDetectedVendors,
  evaluateScenario,
  formatScenarioFailure,
};
