const test = require('node:test');
const assert = require('node:assert/strict');
const { isSafeSpaCandidate } = require('../src/spa');
const { classifyControl } = require('../src/interaction');

const current = 'https://example.test/';

test('SPA candidate safety permits same-origin content routes', () => {
  assert.equal(isSafeSpaCandidate({ href: 'https://example.test/products', text: 'Products' }, current), true);
});

test('SPA candidate safety rejects anchors, external links, downloads, and risky routes', () => {
  assert.equal(isSafeSpaCandidate({ href: 'https://example.test/#section', text: 'Section' }, current), false);
  assert.equal(isSafeSpaCandidate({ href: 'https://external.test/products', text: 'Products' }, current), false);
  assert.equal(isSafeSpaCandidate({ href: 'https://example.test/file.pdf', text: 'Download', download: true }, current), false);
  assert.equal(isSafeSpaCandidate({ href: 'https://example.test/logout', text: 'Logout' }, current), false);
  assert.equal(isSafeSpaCandidate({ href: 'https://example.test/account', text: 'Account' }, current), false);
});

test('SPA candidate safety rejects links that open another browsing target', () => {
  assert.equal(isSafeSpaCandidate({ href: 'https://example.test/products', text: 'Products', target: '_blank' }, current), false);
});

test('safe interaction classification accepts semantic disclosures and rejects unsafe controls', () => {
  assert.equal(classifyControl({ role: 'tab', ariaControls: 'panel', ariaSelected: 'false', label: 'Reviews' }).type, 'tab');
  assert.equal(classifyControl({ tagName: 'SUMMARY', label: 'Specifications' }).type, 'accordion');
  assert.equal(classifyControl({ tagName: 'BUTTON', type: 'submit', label: 'Buy now' }), null);
  assert.equal(classifyControl({ tagName: 'BUTTON', label: 'Continue' }), null);
});
