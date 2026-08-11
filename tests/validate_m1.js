const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log(' M1 VALIDATION & VERIFICATION SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(`  Error: ${err.message}`);
  }
}

// --- 1. Manifest Validation ---
test('1. manifest.json syntax & required fields', () => {
  const content = fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8');
  const manifest = JSON.parse(content);

  assert.strictEqual(manifest.name, 'Sổ Thu Chi', 'Manifest name must match requirement');
  assert.strictEqual(manifest.short_name, 'Sổ Thu Chi', 'Manifest short_name must match requirement');
  assert.strictEqual(manifest.display, 'standalone', 'Manifest display must be standalone');
  assert.strictEqual(manifest.start_url, './', 'Manifest start_url must be ./');
  assert.strictEqual(manifest.background_color, '#0f172a', 'Manifest background_color must match requirement');
  assert.strictEqual(manifest.theme_color, '#0f172a', 'Manifest theme_color must match requirement');
  
  assert.ok(Array.isArray(manifest.icons), 'Manifest icons must be an array');
  assert.ok(manifest.icons.length >= 4, 'Manifest must contain at least 4 icon declarations');

  const requiredIconSizes = ['192x192', '512x512'];
  requiredIconSizes.forEach(size => {
    assert.ok(manifest.icons.some(i => i.sizes === size && i.purpose === 'any'), `Missing any icon for size ${size}`);
    assert.ok(manifest.icons.some(i => i.sizes === size && i.purpose === 'maskable'), `Missing maskable icon for size ${size}`);
  });
});

// --- 2. Icon Files Validation ---
test('2. Icon files exist in icons/ directory', () => {
  const requiredIconFiles = [
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-192.png',
    'icon-maskable-512.png'
  ];

  requiredIconFiles.forEach(iconFile => {
    const filePath = path.join(__dirname, '../icons', iconFile);
    assert.ok(fs.existsSync(filePath), `Icon file missing: ${iconFile}`);
    const stats = fs.statSync(filePath);
    assert.ok(stats.size > 0, `Icon file is empty: ${iconFile}`);
  });
});

// --- 3. HTML5 App Shell Validation ---
test('3. index.html structure & contract IDs', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

  // Check required meta tags
  assert.ok(html.includes('viewport-fit=cover'), 'Missing viewport-fit=cover meta tag');
  assert.ok(html.includes('manifest.json'), 'Missing manifest link');
  assert.ok(html.includes('style.css'), 'Missing style.css stylesheet link');
  assert.ok(html.includes('app.js'), 'Missing app.js script tag');
  assert.ok(html.includes('apple-mobile-web-app-capable'), 'Missing iOS Safari meta tag');

  // Check required contract IDs
  const contractIDs = [
    'app-header',
    'view-title',
    'sync-status',
    'theme-toggle',
    'app-nav',
    'nav-transactions',
    'nav-budget',
    'nav-reports',
    'nav-settings',
    'main-content',
    'view-transactions',
    'view-budget',
    'view-reports',
    'view-settings'
  ];

  contractIDs.forEach(id => {
    assert.ok(html.includes(`id="${id}"`), `Contract ID missing in index.html: #${id}`);
  });
});

// --- 4. CSS Architecture & Themes Validation ---
test('4. style.css design tokens & responsive layout', () => {
  const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');

  assert.ok(css.includes(':root'), 'Missing :root custom properties definition');
  assert.ok(css.includes('[data-theme="dark"]') || css.includes('[data-theme=\'dark\']') || css.includes('data-theme="dark"'), 'Missing dark theme overrides');
  assert.ok(css.includes('env(safe-area-inset-top'), 'Missing safe area inset top');
  assert.ok(css.includes('env(safe-area-inset-bottom'), 'Missing safe area inset bottom');
  assert.ok(css.includes('@media (min-width: 768px)'), 'Missing desktop layout media query');
  assert.ok(css.includes('.view-panel'), 'Missing .view-panel view section class');
  assert.ok(css.includes('.status-online'), 'Missing .status-online sync indicator class');
  assert.ok(css.includes('.status-offline'), 'Missing .status-offline sync indicator class');
});

// --- 5. Service Worker Validation ---
test('5. sw.js cache name, precache list & event handlers', () => {
  const sw = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');

  assert.ok(sw.includes('so-thu-chi-v1'), 'Missing cache version so-thu-chi-v1');
  assert.ok(sw.includes('install'), 'Missing install event listener');
  assert.ok(sw.includes('activate'), 'Missing activate event listener');
  assert.ok(sw.includes('fetch'), 'Missing fetch event listener');
  assert.ok(sw.includes('skipWaiting'), 'Missing skipWaiting in install handler');
  assert.ok(sw.includes('claim'), 'Missing clients.claim in activate handler');
  assert.ok(sw.includes('script.google.com'), 'Missing Google Apps Script bypass rule');

  const precacheItems = [
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
  ];

  precacheItems.forEach(item => {
    assert.ok(sw.includes(item) || sw.includes(item.replace('./', '')), `Missing precache item: ${item}`);
  });
});

// --- 6. JavaScript Logic & Implementation Validation ---
test('6. app.js JS syntax check & module structure', () => {
  const appContent = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

  assert.ok(appContent.includes('registerServiceWorker'), 'Missing registerServiceWorker function');
  assert.ok(appContent.includes('ThemeEngine'), 'Missing ThemeEngine module');
  assert.ok(appContent.includes('Router'), 'Missing Router module');
  assert.ok(appContent.includes('App'), 'Missing App lifecycle module');
  assert.ok(appContent.includes('themechanged'), 'Missing custom themechanged event dispatch');
  assert.ok(appContent.includes('routechanged'), 'Missing custom routechanged event dispatch');
});

console.log('\n----------------------------------------------------');
console.log(`Results: ${passedTests} / ${totalTests} tests passed.`);
console.log('----------------------------------------------------');

if (passedTests !== totalTests) {
  process.exit(1);
}
