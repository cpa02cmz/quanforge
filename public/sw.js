const CACHE_NAME = 'quanforge-ai-v1.0.0';
const STATIC_CACHE_NAME = 'quanforge-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'quanforge-dynamic-v1.0.0';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml'
];

const API_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STATIC_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Cache strategies
const cacheStrategies = {
  static: 'cacheFirst',
  api: 'networkFirst',
  dynamic: 'staleWhileRevalidate'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const strategy = getCacheStrategy(url);
  
  try {
    switch (strategy) {
      case 'cacheFirst':
        return await cacheFirst(request);
      case 'networkFirst':
        return await networkFirst(request);
      case 'staleWhileRevalidate':
        return await staleWhileRevalidate(request);
      default:
        return await fetch(request);
    }
  } catch (error) {
    console.error('[SW] Request failed:', error);
    return await getOfflineResponse(request);
  }
}

function getCacheStrategy(url) {
  // Static assets
  if (url.pathname.includes('/assets/') || 
      url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return cacheStrategies.static;
  }
  
  // API calls
  if (url.pathname.includes('/api/') || 
      url.hostname.includes('supabase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('twelvedata')) {
    return cacheStrategies.api;
  }
  
  // Dynamic content
  return cacheStrategies.dynamic;
}

// Cache First strategy for static assets
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network request failed:', error);
    throw error;
  }
}

// Network First strategy for API calls
async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache the successful response
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network request failed, serving from cache:', error);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Stale While Revalidate strategy for dynamic content
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Always try to update the cache in the background
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.error('[SW] Background fetch failed:', error);
    });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Otherwise wait for the network
  return await fetchPromise;
}

// Offline fallback
async function getOfflineResponse(request) {
  const url = new URL(request.url);
  
  // Return cached page for navigation requests
  if (request.mode === 'navigate') {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedPage = await cache.match('/');
    if (cachedPage) {
      return cachedPage;
    }
  }
  
  // Return offline fallback for API requests
  if (url.pathname.includes('/api/')) {
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'No network connection available' 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Default offline response
  return new Response('Offline', { status: 503 });
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-robots') {
    event.waitUntil(syncRobotsData());
  }
});

async function syncRobotsData() {
  try {
    // Get cached data that needs to be synced
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const pendingRequests = await cache.keys();
    
    for (const request of pendingRequests) {
      if (request.url.includes('/api/robots')) {
        try {
          await fetch(request);
          console.log('[SW] Synced request:', request.url);
        } catch (error) {
          console.error('[SW] Failed to sync request:', request.url, error);
        }
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Push notifications (if needed in the future)
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from QuantForge AI',
    icon: '/manifest.json',
    badge: '/manifest.json',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Explore',
        icon: '/manifest.json'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/manifest.json'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('QuantForge AI', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received:', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periodic background sync for cache updates
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);
  
  if (event.tag === 'cache-update') {
    event.waitUntil(updateCaches());
  }
});

async function updateCaches() {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    await cache.addAll(STATIC_ASSETS);
    console.log('[SW] Caches updated successfully');
  } catch (error) {
    console.error('[SW] Failed to update caches:', error);
  }
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    event.waitUntil(updateCaches());
  }
  
  if (event.data && event.data.type === 'CACHE_CLEAR') {
    event.waitUntil(clearCaches());
  }
});

async function clearCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('[SW] All caches cleared');
  } catch (error) {
    console.error('[SW] Failed to clear caches:', error);
  }
}