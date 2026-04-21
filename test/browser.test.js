const test = require('node:test');
const assert = require('node:assert/strict');

const { CONSENT_SELECTORS, matchesConsentText } = require('../src/browser');

test('consent matching accepts explicit consent language', () => {
  assert.equal(matchesConsentText('Accept all cookies'), true);
  assert.equal(matchesConsentText('I agree'), true);
});

test('consent matching rejects generic CTA language', () => {
  assert.equal(matchesConsentText('Continue to checkout'), false);
  assert.equal(matchesConsentText('View account'), false);
});

test('consent selectors avoid anchors to reduce accidental navigation', () => {
  assert.equal(CONSENT_SELECTORS.includes('a'), false);
});
