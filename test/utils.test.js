const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalPageKey, sameSite, sameSiteHost } = require('../src/utils');

test('sameSite treats apex and www hosts as the same site', () => {
  assert.equal(sameSite('https://www.example.com', 'https://example.com/pricing'), true);
  assert.equal(sameSite('https://example.com', 'https://www.example.com/contact'), true);
});

test('sameSiteHost accepts subdomains but rejects lookalike hosts', () => {
  assert.equal(sameSiteHost('example.com', 'shop.example.com'), true);
  assert.equal(sameSiteHost('example.com', 'badexample.com'), false);
  assert.equal(sameSiteHost('www.example.com', 'example.com'), true);
});

test('canonicalPageKey collapses duplicate homepage URL variants', () => {
  const keys = [
    'https://www.example.com',
    'https://example.com/',
    'https://example.com/#main',
    'https://example.com/?utm_source=newsletter&fbclid=abc',
  ].map(canonicalPageKey);

  assert.equal(new Set(keys).size, 1);
  assert.equal(keys[0], 'https://example.com/');
});

test('canonicalPageKey keeps distinct content query params but ignores tracking params', () => {
  assert.equal(
    canonicalPageKey('https://example.com/products/?page=2&utm_campaign=spring#details'),
    'https://example.com/products?page=2'
  );
  assert.notEqual(
    canonicalPageKey('https://example.com/products?page=2'),
    canonicalPageKey('https://example.com/products?page=3')
  );
});
