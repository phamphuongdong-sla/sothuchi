const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'manifest.json');
const SW_PATH = path.join(PROJECT_ROOT, 'sw.js');

console.log('=== EMPIRICAL PWA & SERVICE WORKER TEST HARNESS ===\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

// -------------------------------------------------------------
// SECTION 1: Manifest Schema & Icon Existence Verification
// -------------------------------------------------------------
console.log('--- SECTION 1: PWA Manifest (manifest.json) Validation ---');

let manifest;
try {
  const rawManifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
  manifest = JSON.parse(rawManifest);
  assert(true, 'manifest.json is valid JSON');
} catch (err) {
  assert(false, `manifest.json JSON parsing failed: ${err.message}`);
}

if (manifest) {
  assert(typeof manifest.name === 'string' && manifest.name.trim().length > 0, `name property is non-empty string ("${manifest.name}")`);
  assert(typeof manifest.short_name === 'string' && manifest.short_name.trim().length > 0, `short_name property is non-empty string ("${manifest.short_name}")`);
  assert(typeof manifest.start_url === 'string', `start_url property is string ("${manifest.start_url}")`);
  assert(typeof manifest.display === 'string' && ['standalone', 'fullscreen', 'minimal-ui', 'browser'].includes(manifest.display), `display property is valid ("${manifest.display}")`);
  assert(typeof manifest.background_color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(manifest.background_color), `background_color is valid hex ("${manifest.background_color}")`);
  assert(typeof manifest.theme_color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(manifest.theme_color), `theme_color is valid hex ("${manifest.theme_color}")`);
  assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'icons is non-empty array');

  // Check required sizes: 192x192, 512x512, maskable
  let has192 = false;
  let has512 = false;
  let hasMaskable = false;

  (manifest.icons || []).forEach((icon, idx) => {
    assert(typeof icon.src === 'string', `icon[${idx}] has src: ${icon.src}`);
    assert(typeof icon.sizes === 'string', `icon[${idx}] has sizes: ${icon.sizes}`);
    assert(typeof icon.type === 'string', `icon[${idx}] has type: ${icon.type}`);

    if (icon.sizes === '192x192') has192 = true;
    if (icon.sizes === '512x512') has512 = true;
    if (icon.purpose && icon.purpose.includes('maskable')) hasMaskable = true;

    // Disk existence check
    const iconDiskPath = path.join(PROJECT_ROOT, icon.src);
    const exists = fs.existsSync(iconDiskPath);
    assert(exists, `Manifest icon file exists on disk: ${icon.src}`);
    if (exists) {
      const stats = fs.statSync(iconDiskPath);
      assert(stats.size > 0, `Manifest icon file non-empty (${stats.size} bytes): ${icon.src}`);
    }
  });

  assert(has192, 'Manifest defines 192x192 icon');
  assert(has512, 'Manifest defines 512x512 icon');
  assert(hasMaskable, 'Manifest defines maskable icon');

  // Check shortcuts icons if present
  if (Array.isArray(manifest.shortcuts)) {
    manifest.shortcuts.forEach((sc, idx) => {
      assert(typeof sc.name === 'string', `shortcut[${idx}] has name: ${sc.name}`);
      assert(typeof sc.url === 'string', `shortcut[${idx}] has url: ${sc.url}`);
      if (Array.isArray(sc.icons)) {
        sc.icons.forEach((icon) => {
          const iconDiskPath = path.join(PROJECT_ROOT, icon.src);
          assert(fs.existsSync(iconDiskPath), `Shortcut icon exists on disk: ${icon.src}`);
        });
      }
    });
  }
}

// -------------------------------------------------------------
// SECTION 2: Service Worker Precache Asset Disk Verification
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Service Worker (sw.js) Precache Asset Verification ---');

let swContent;
try {
  swContent = fs.readFileSync(SW_PATH, 'utf8');
  assert(true, 'sw.js readable');
} catch (err) {
  assert(false, `sw.js read error: ${err.message}`);
}

let precacheAssets = [];
let cacheName = '';

if (swContent) {
  const cacheNameMatch = swContent.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
  if (cacheNameMatch) {
    cacheName = cacheNameMatch[1];
    assert(true, `Found CACHE_NAME in sw.js: "${cacheName}"`);
  } else {
    assert(false, 'CACHE_NAME defined in sw.js');
  }

  const precacheMatch = swContent.match(/PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  if (precacheMatch) {
    try {
      precacheAssets = eval(`[${precacheMatch[1]}]`);
      assert(Array.isArray(precacheAssets) && precacheAssets.length > 0, `Found PRECACHE_ASSETS array (${precacheAssets.length} items)`);
    } catch (e) {
      assert(false, `Failed to parse PRECACHE_ASSETS: ${e.message}`);
    }
  } else {
    assert(false, 'PRECACHE_ASSETS defined in sw.js');
  }

  precacheAssets.forEach((assetPath) => {
    let relativePath = assetPath;
    if (relativePath === './' || relativePath === '.') {
      relativePath = 'index.html'; // Root maps to index.html or project dir
    } else if (relativePath.startsWith('./')) {
      relativePath = relativePath.slice(2);
    }

    const fullDiskPath = path.join(PROJECT_ROOT, relativePath);
    const exists = fs.existsSync(fullDiskPath);
    assert(exists, `Precache asset exists on disk: "${assetPath}" -> ${relativePath}`);
    if (exists) {
      const stats = fs.statSync(fullDiskPath);
      assert(stats.size > 0, `Precache asset is non-empty (${stats.size} bytes): "${assetPath}"`);
    }
  });
}

// -------------------------------------------------------------
// SECTION 3: Service Worker Event Listener & Simulation Tests
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Service Worker Fetch Strategy Simulation ---');

if (swContent) {
  // Mocking ServiceWorker runtime environment
  const eventListeners = {};
  const mockCacheStore = new Map();

  class MockResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = init.headers || {};
    }
    clone() {
      return new MockResponse(this.body, { status: this.status, statusText: this.statusText, headers: { ...this.headers } });
    }
  }

  class MockRequest {
    constructor(url, init = {}) {
      this.url = url;
      this.method = init.method || 'GET';
      this.mode = init.mode || 'cors';
    }
  }

  class MockCache {
    async addAll(urls) {
      for (const u of urls) {
        mockCacheStore.set(u, new MockResponse(`cached:${u}`));
      }
    }
    async match(req) {
      const urlStr = typeof req === 'string' ? req : req.url;
      return mockCacheStore.get(urlStr) || null;
    }
    async put(req, resp) {
      const urlStr = typeof req === 'string' ? req : req.url;
      mockCacheStore.set(urlStr, resp);
    }
  }

  const mockCaches = {
    open: async (name) => new MockCache(),
    match: async (req) => {
      const urlStr = typeof req === 'string' ? req : req.url;
      return mockCacheStore.get(urlStr) || null;
    },
    keys: async () => [cacheName, 'old-cache-v0'],
    delete: async (name) => {
      return true;
    }
  };

  const mockSelf = {
    addEventListener: (type, fn) => {
      eventListeners[type] = fn;
    },
    skipWaiting: async () => {},
    clients: {
      claim: async () => {}
    }
  };

  // Mock global fetch function
  let fetchHandler = async (req) => {
    const urlStr = typeof req === 'string' ? req : req.url;
    return new MockResponse(`network:${urlStr}`);
  };

  const mockFetch = (req) => fetchHandler(req);

  const sandbox = {
    self: mockSelf,
    addEventListener: mockSelf.addEventListener.bind(mockSelf),
    caches: mockCaches,
    fetch: mockFetch,
    Request: MockRequest,
    Response: MockResponse,
    URL: URL,
    console: console
  };

  vm.createContext(sandbox);
  try {
    vm.runInContext(swContent, sandbox);
    assert(true, 'sw.js executed in VM context without syntax errors');
  } catch (err) {
    assert(false, `sw.js execution failed: ${err.message}`);
  }

  assert(typeof eventListeners['install'] === 'function', 'sw.js registers "install" listener');
  assert(typeof eventListeners['activate'] === 'function', 'sw.js registers "activate" listener');
  assert(typeof eventListeners['fetch'] === 'function', 'sw.js registers "fetch" listener');

  // Test 3.1: Install event precaching
  (async () => {
    let waitUntilPromise = null;
    const mockInstallEvent = {
      waitUntil: (promise) => { waitUntilPromise = promise; }
    };
    if (eventListeners['install']) {
      eventListeners['install'](mockInstallEvent);
      await waitUntilPromise;
      assert(mockCacheStore.size === precacheAssets.length, `Install event precached ${mockCacheStore.size} assets`);
    }

    // Helper to simulate fetch event
    async function simulateFetch(urlStr, options = {}) {
      let respondWithPromise = null;
      let responded = false;

      const event = {
        request: new MockRequest(urlStr, options),
        respondWith: (promise) => {
          responded = true;
          respondWithPromise = promise;
        }
      };

      eventListeners['fetch'](event);
      if (!responded) return { bypassed: true, response: null };
      const response = await respondWithPromise;
      return { bypassed: false, response };
    }

    // Test 3.2: Non-GET bypass
    const postRes = await simulateFetch('https://example.com/api', { method: 'POST' });
    assert(postRes.bypassed === true, 'POST request bypasses Service Worker caching');

    // Test 3.3: Non-HTTP scheme bypass
    const extRes = await simulateFetch('chrome-extension://abc/def');
    assert(extRes.bypassed === true, 'Non-HTTP scheme (chrome-extension://) bypasses Service Worker caching');

    // Test 3.4: Google Apps Script network-only bypass
    const gasRes1 = await simulateFetch('https://script.google.com/macros/s/AKfycbx.../exec');
    assert(gasRes1.bypassed === true, 'Google Apps Script (script.google.com) request bypasses Service Worker caching');

    const gasRes2 = await simulateFetch('https://script.googleusercontent.com/userCode/...');
    assert(gasRes2.bypassed === true, 'Google Apps Script CDN (script.googleusercontent.com) request bypasses Service Worker caching');

    // Test 3.5: Navigation request (SPA fallback)
    fetchHandler = async (req) => { throw new Error('Offline'); }; // Simulate offline
    const navResOffline = await simulateFetch('https://example.com/history', { mode: 'navigate' });
    assert(navResOffline.bypassed === false, 'Navigation request intercepted by Service Worker');
    assert(navResOffline.response && navResOffline.response.body.includes('./index.html'), 'Offline navigation request falls back to index.html');

    // Test 3.6: Cache-First strategy for CDN / PNG image assets
    mockCacheStore.clear();
    mockCacheStore.set('https://cdn.jsdelivr.net/npm/chart.js', new MockResponse('cached-chartjs'));

    fetchHandler = async (req) => new MockResponse('network-chartjs');
    const cacheFirstHit = await simulateFetch('https://cdn.jsdelivr.net/npm/chart.js');
    assert(cacheFirstHit.response.body === 'cached-chartjs', 'Cache-First strategy returns cached asset without hitting network');

    // Cache Miss scenario for CDN asset
    const cacheFirstMiss = await simulateFetch('https://cdn.jsdelivr.net/npm/chart.js/dist/chart.min.js');
    assert(cacheFirstMiss.response.body === 'network-chartjs', 'Cache-First miss fetches from network and updates cache');

    // Test 3.7: Stale-While-Revalidate strategy for App Shell assets (app.js, style.css)
    mockCacheStore.clear();
    mockCacheStore.set('https://example.com/app.js', new MockResponse('stale-app-js'));

    let networkFetched = false;
    fetchHandler = async (req) => {
      networkFetched = true;
      return new MockResponse('fresh-app-js');
    };

    const swrRes = await simulateFetch('https://example.com/app.js');
    assert(swrRes.response.body === 'stale-app-js', 'Stale-While-Revalidate returns stale cached asset immediately');
    
    // Wait for background revalidation
    await new Promise(r => setTimeout(r, 50));
    assert(networkFetched === true, 'Stale-While-Revalidate triggers background network fetch');
    assert(mockCacheStore.get('https://example.com/app.js').body === 'fresh-app-js', 'Stale-While-Revalidate updates cache with fresh response');

    // Test 3.8: Offline handling during Stale-While-Revalidate
    mockCacheStore.set('https://example.com/style.css', new MockResponse('stale-style-css'));
    fetchHandler = async (req) => { throw new Error('Network Error'); };
    const swrOfflineRes = await simulateFetch('https://example.com/style.css');
    assert(swrOfflineRes.response.body === 'stale-style-css', 'Stale-While-Revalidate gracefully returns cached copy even if revalidation network fetch fails');

    console.log(`\n=== TEST RESULTS SUMMARY ===`);
    console.log(`Total Passed: ${passedTests}`);
    console.log(`Total Failed: ${failedTests}`);
    if (failedTests === 0) {
      console.log('VERDICT: APPROVE');
    } else {
      console.log('VERDICT: REJECT');
    }
  })();
}
