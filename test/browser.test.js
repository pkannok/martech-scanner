const test = require('node:test');
const assert = require('node:assert/strict');

const { CONSENT_SELECTORS, matchesConsentText } = require('../src/browser');
const { recognizeConsentControl } = require('../src/consent');

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

test('consent recognition requires context for ambiguous controls', () => {
  const control = parts => ({
    parts,
    ancestors: [{ text: 'Checkout', role: '', id: '', className: '' }],
  });
  assert.equal(recognizeConsentControl(control(['Continue'])), null);
  assert.equal(recognizeConsentControl({
    parts: ['Continue'],
    ancestors: [{ text: 'We use cookies and privacy controls', role: 'dialog', id: '', className: '' }],
  }).action, 'accept');
});

test('consent recognition rejects decline and preference actions', () => {
  assert.equal(recognizeConsentControl({
    parts: ['Manage preferences'],
    ancestors: [{ text: 'Cookie consent', role: 'dialog', id: '', className: '' }],
  }), null);
});
