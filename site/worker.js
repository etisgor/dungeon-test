const release = {"version":"0.1.8","key":"dafdebe7dbcb278ff3a8dd17fa97267e19a5b3b0f09aa7e58df82bea59a5a985","files":[["assets/index-B-4N3BnK.css","sha256-SfBhVzDW44+RbviqZg4XzcMlrUeLFKzj2Xxn71elQEw="],["assets/index-CI76peus.js","sha256-xWj02KNXVl+DOAvg5rC7HksH5ZtrP6clr2wUwr3oK+o="],["icons/dungeon-192.png","sha256-6ts/szBvqXjXYy04WQJVEBSfL8whfmWueP7GBLv9HXs="],["icons/dungeon-512.png","sha256-SqysRdTfP0bG8OjHCip4/wXN7QlKmgTicsC8vHBGilc="],["icons/dungeon-maskable-512.png","sha256-SqysRdTfP0bG8OjHCip4/wXN7QlKmgTicsC8vHBGilc="],["index.html","sha256-KuOpmAW7DyJbXO3qC06ZWQqeWlrRhJkZudB9xJzVBGY="],["manifest.webmanifest","sha256-8wHWmJnw9mLuMMNPR04HUG5V8LhCnOohtPacZcE8RKE="]]};
const scope = new URL(self.registration.scope);
const app = new URL('index.html', scope).href;
const entryPath = new URL(app).pathname;
const prefix = 'dungeon-pwa:' + encodeURIComponent(scope.pathname) + ':';
const releasePrefix = prefix + 'release:';
const releaseCache = releasePrefix + release.version + ':' + release.key;
const readyMarker = new URL('.offline-ready', scope).href;
const historyMarker = new URL('.offline-history', scope).href;
const files = new Map(release.files.map(([path, hash]) => {
  const url = new URL(path, scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || url.search || url.hash
    || url.href === self.location.href || url.href === readyMarker || url.href === historyMarker
    || !/^sha256-[A-Za-z0-9+/]{43}=$/.test(hash)) throw new Error('Invalid offline asset.');
  return [url.href, hash];
}));
if (files.size !== release.files.length || !files.has(app)) throw new Error('Incomplete offline release manifest.');

async function verifiedResponse(url, hash) {
  const response = await fetch(url === app ? scope.href : url,
    { cache: 'reload', credentials: 'same-origin', redirect: 'error' });
  if (response.status !== 200) throw new Error('Offline asset HTTP ' + response.status);
  const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
  if ('sha256-' + btoa(String.fromCharCode(...new Uint8Array(digest))) !== hash) {
    throw new Error('Offline asset integrity check failed.');
  }
  return response;
}

async function complete(cache) {
  return (await cache.match(readyMarker))?.headers.get('X-Dungeon-Release') === release.key
    && (await Promise.all([...files.keys()].map(url => cache.match(url)))).every(Boolean);
}

async function install() {
  const cache = await caches.open(releaseCache);
  if (await complete(cache)) return;
  const hadReadyMarker = Boolean(await cache.match(readyMarker));
  try {
    for (const [url, hash] of files) await cache.put(url, await verifiedResponse(url, hash));
    await cache.put(readyMarker, new Response(null, { headers: { 'X-Dungeon-Release': release.key } }));
  } catch (error) {
    if (!hadReadyMarker) await caches.delete(releaseCache);
    throw error;
  }
}

async function activate() {
  try {
    const history = await caches.open(prefix + 'history');
    const snapshot = await history.match(historyMarker);
    const { active, previous } = snapshot ? await snapshot.json() : {};
    if (active !== releaseCache) {
      await history.put(historyMarker, new Response(JSON.stringify({ active: releaseCache, previous: active })));
      if (previous?.startsWith(releasePrefix) && previous !== releaseCache) await caches.delete(previous);
    }
  } catch (error) {
    console.warn('Dungeon offline cache cleanup deferred.', error);
  }
  await self.clients.claim();
}

async function serve(url, hash) {
  try {
    const cache = await caches.open(releaseCache);
    const cached = await cache.match(url);
    if (cached) return cached;
    const response = await verifiedResponse(url, hash);
    await cache.put(url, response.clone());
    return response;
  } catch {
    return new Response('This offline copy is incomplete. Reconnect and reload Dungeon.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

function isAppWindow(source) {
  if (!source?.url) return false;
  const url = new URL(source.url);
  return url.origin === scope.origin && (url.pathname === scope.pathname || url.pathname === entryPath);
}

async function handleMessage(message, source) {
  const { type, version, key } = message;
  if (!await complete(await caches.open(releaseCache))) return { state: 'error', detail: 'The offline copy is incomplete.' };
  if (type === 'status') return { state: 'ready', version: release.version, key: release.key };
  if (version !== release.version || key !== release.key) return { state: 'blocked', detail: 'The waiting release changed. Check for updates again.' };
  const others = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (others.some(client => client.id !== source.id && isAppWindow(client))) {
    return { state: 'blocked', detail: 'Close the other Dungeon tabs or windows before applying the update.' };
  }
  await self.skipWaiting();
  return { state: 'activating' };
}

self.addEventListener('install', event => event.waitUntil(install()));
self.addEventListener('activate', event => event.waitUntil(activate()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const request = new URL(event.request.url);
  const isEntry = event.request.mode === 'navigate' && request.origin === scope.origin
    && (request.pathname === scope.pathname || request.pathname === entryPath);
  const target = isEntry ? app : request.href;
  const hash = files.get(target);
  if (hash) event.respondWith(serve(target, hash));
});
self.addEventListener('message', event => {
  const port = event.ports[0];
  if (!port || !isAppWindow(event.source) || !['status', 'activate'].includes(event.data?.type)) return;
  event.waitUntil(handleMessage(event.data, event.source)
    .then(result => port.postMessage(result), () => port.postMessage({ state: 'error', detail: 'Unable to verify the offline copy.' })));
});
