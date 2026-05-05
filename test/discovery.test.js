const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getHostnameDiversityScore,
  prioritizeScanUrls,
  scoreDiscoveredUrl,
} = require('../src/discovery');

test('hostname diversity boosts distinct same-site subdomains', () => {
  const seedUrl = 'https://example.com';

  assert.equal(getHostnameDiversityScore('https://example.com/contact', seedUrl), 0);
  assert.ok(getHostnameDiversityScore('https://shop.example.com/', seedUrl) > 0);
  assert.ok(
    getHostnameDiversityScore('https://shop.example.com/', seedUrl) >
      getHostnameDiversityScore('https://cdn.example.com/logo.png', seedUrl)
  );
  assert.ok(scoreDiscoveredUrl(seedUrl, 'https://shop.example.com/') > scoreDiscoveredUrl(seedUrl, 'https://example.com/about'));
  assert.ok(scoreDiscoveredUrl(seedUrl, 'https://other-example.com/') < 0);
});

test('prioritizeScanUrls samples a distinct subdomain before extra same-host pages', () => {
  const seedUrl = 'https://example.com';
  const urls = [
    'https://example.com/about',
    'https://example.com/products',
    'https://example.com/checkout',
    'https://app.example.com/dashboard',
  ];

  assert.deepEqual(prioritizeScanUrls(seedUrl, urls, 3), [
    'https://example.com',
    'https://app.example.com/dashboard',
    'https://example.com/checkout',
  ]);
});

test('prioritizeScanUrls keeps high-intent root-domain paths competitive', () => {
  const seedUrl = 'https://example.com';
  const urls = [
    'https://example.com/about',
    'https://example.com/contact',
    'https://example.com/checkout',
    'https://blog.example.com/about',
  ];

  const prioritized = prioritizeScanUrls(seedUrl, urls, 4);

  assert.equal(prioritized[0], 'https://example.com');
  assert.ok(prioritized.includes('https://blog.example.com/about'));
  assert.ok(prioritized.includes('https://example.com/checkout'));
  assert.equal(prioritized.includes('https://example.com/about'), false);
});

test('prioritizeScanUrls does not let static subdomains displace useful URLs', () => {
  const seedUrl = 'https://example.com';
  const urls = [
    'https://cdn.example.com/assets/app.js',
    'https://static.example.com/logo.png',
    'https://shop.example.com/',
    'https://example.com/contact',
  ];

  assert.deepEqual(prioritizeScanUrls(seedUrl, urls, 3), [
    'https://example.com',
    'https://shop.example.com',
    'https://example.com/contact',
  ]);
});

test('prioritizeScanUrls keeps selection same-site and deterministic', () => {
  const seedUrl = 'https://www.example.com';
  const urls = [
    'https://example.com/?utm_source=email',
    'https://support.example.com/help',
    'https://badexample.com/checkout',
    'https://offers.example.com/spring',
    'https://support.example.com/contact',
  ];

  assert.deepEqual(prioritizeScanUrls(seedUrl, urls, 4), [
    'https://www.example.com',
    'https://support.example.com/contact',
    'https://offers.example.com/spring',
    'https://support.example.com/help',
  ]);
});
