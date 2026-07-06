const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const packageJson = require('../package.json');
const packageLock = require('../package-lock.json');
const {
  SCANNER_NAME,
  SCANNER_VERSION,
  REPORT_TEMPLATE_VERSION,
} = require('../src/version');

test('package metadata and shared scanner identity stay aligned', () => {
  assert.equal(SCANNER_NAME, 'MarTech Scanner');
  assert.equal(SCANNER_VERSION, packageJson.version);
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[''].version, packageJson.version);
});

test('report template version is explicit and the stale combined title is absent from source', () => {
  assert.equal(REPORT_TEMPLATE_VERSION, '2.7');
  const reportingSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'reporting.js'), 'utf8');
  assert.doesNotMatch(reportingSource, /Martech Scan Summary v2\.3/);
});
