const DEFAULT_TIMEOUT = 45000;
const DEFAULT_OUT_DIR = './output';
const DEFAULT_MAX_PAGES = 6;
const DEFAULT_WAIT_AFTER_LOAD_MS = 3500;

const PRIORITY_KEYWORDS = [
  'about',
  'contact',
  'book',
  'booking',
  'reserve',
  'reservation',
  'shop',
  'store',
  'product',
  'cart',
  'checkout',
  'login',
  'log-in',
  'signin',
  'sign-in',
  'account',
  'register',
  'join',
  'subscribe',
  'pricing',
  'plan',
  'demo',
  'trial',
];

const ID_RULES = [
  { type: 'GTM Container ID', re: /GTM-[A-Z0-9]+/g },
  { type: 'GA4 Measurement ID', re: /\bG-[A-Z0-9]+\b/g },
  { type: 'UA Property ID', re: /UA-\d+-\d+/g },
  { type: 'Google Ads ID', re: /AW-\d+/g },
  { type: 'Adobe Org ID', re: /[A-F0-9]{24}@AdobeOrg/g },
  { type: 'Facebook Pixel ID', re: /[?&]id=(\d{5,})/g, group: 1 },
  { type: 'LinkedIn Partner ID', re: /[?&]pid=(\d{3,})/g, group: 1 },
  { type: 'TikTok Pixel ID', re: /[?&]pixel_id=([A-Za-z0-9]+)/g, group: 1 },
  { type: 'Pinterest Tag ID', re: /[?&]tid=(\d{3,})/g, group: 1 },
];

const USER_AGENT_DISCOVERY =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari PlaywrightScanner/2.1-discovery';

const USER_AGENT_SCAN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari PlaywrightScanner/2.1';

module.exports = {
  DEFAULT_TIMEOUT,
  DEFAULT_OUT_DIR,
  DEFAULT_MAX_PAGES,
  DEFAULT_WAIT_AFTER_LOAD_MS,
  PRIORITY_KEYWORDS,
  ID_RULES,
  USER_AGENT_DISCOVERY,
  USER_AGENT_SCAN,
};