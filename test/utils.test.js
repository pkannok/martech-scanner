const test = require('node:test');
const assert = require('node:assert/strict');

const { sameSite, sameSiteHost } = require('../src/utils');

test('sameSite treats apex and www hosts as the same site', () => {
  assert.equal(sameSite('https://www.example.com', 'https://example.com/pricing'), true);
  assert.equal(sameSite('https://example.com', 'https://www.example.com/contact'), true);
});

test('sameSiteHost accepts subdomains but rejects lookalike hosts', () => {
  assert.equal(sameSiteHost('example.com', 'shop.example.com'), true);
  assert.equal(sameSiteHost('example.com', 'badexample.com'), false);
  assert.equal(sameSiteHost('www.example.com', 'example.com'), true);
});
