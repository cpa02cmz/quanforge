const CACHE_NAME = 'quanforge-edge-v2';
const STATIC_CACHE_NAME = 'quanforge-static-v2';
const API_CACHE_NAME = 'quanforge-api-v2';

// Enhanced cache configuration for Vercel Edge
const CACHE_CONFIG = {
  staticAssets: {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    patterns: [
      /\.(js|css|woff|woff2|ttf|eot|png|jpg|jpeg|gif|svg|ico|webp)$/,
      /\/fonts\//,
      /\/images\//,
    ],
  },
  apiResponses: {
    maxAge: 5 * 60 * 1000, // 5 minutes
    patterns: [
      /\/api\//,
    ],
  },
  pages: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    patterns: [
      /\/$/,
      /\/dashboard/,
      /\/generator/,
      /\/wiki/,
    ],
  },
};

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  '/dashboard',
  '/generator',
  '/wiki'
];

// Cache strategies optimized for Vercel Edge
const cacheStrategies = {
  static: 'cacheFirst',
  api: 'networkFirst',
  dynamic: 'staleWhileRevalidate',
  edge: 'edgeFirst'
};

// Install event - cache static assets with enhanced error handling
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker for Vercel Edge...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets for edge deployment');
        return Promise.allSettled(
          STATIC_ASSETS.map(asset => 
            cache.add(asset).catch(error => {
              console.warn(`[SW] Failed to cache ${asset}:`, error);
              return null;
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully for edge');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Service worker installation failed:', error);
      })
  );
});

// Activate event - clean up old caches with enhanced cleanup
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker for Vercel Edge...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        const currentCaches = [CACHE_NAME, STATIC_CACHE_NAME, API_CACHE_NAME];
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated for edge deployment');
        return self.clients.claim();
      })
      .then(() => {
        // Pre-warm edge caches
        return preWarmEdgeCaches();
      })
      .catch((error) => {
        console.error('[SW] Service worker activation failed:', error);
      })
  );
});

// Pre-warm edge caches for better performance
async function preWarmEdgeCaches() {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const criticalAssets = [
      '/api/health',
      '/api/strategies',
    ];
    
    await Promise.allSettled(
      criticalAssets.map(asset => 
        fetch(asset).then(response => {
          if (response.ok) {
            return cache.put(asset, response);
          }
        }).catch(error => {
          console.warn(`[SW] Failed to pre-warm ${asset}:`, error);
        })
      )
    );
    
    console.log('[SW] Edge caches pre-warmed successfully');
  } catch (error) {
    console.warn('[SW] Edge cache pre-warming failed:', error);
  }
}

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
      case 'edgeFirst':
        return await edgeFirst(request);
      default:
        return await fetch(request);
    }
  } catch (error) {
    console.error('[SW] Request failed:', error);
    return await getOfflineResponse(request);
  }
}

function getCacheStrategy(url) {
  // Static assets with enhanced patterns
  if (CACHE_CONFIG.staticAssets.patterns.some(pattern => pattern.test(url.pathname))) {
    return cacheStrategies.static;
  }
  
  // API calls with external service detection
  if (CACHE_CONFIG.apiResponses.patterns.some(pattern => pattern.test(url.pathname)) ||
      url.hostname.includes('supabase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('twelvedata')) {
    return cacheStrategies.api;
  }
  
  // Page requests
  if (CACHE_CONFIG.pages.patterns.some(pattern => pattern.test(url.pathname)) ||
      request.mode === 'navigate') {
    return cacheStrategies.dynamic;
  }
  
  // Edge-optimized content
  if (url.searchParams.has('edge') || url.searchParams.has('cache')) {
    return cacheStrategies.edge;
  }
  
  // Default to dynamic
  return cacheStrategies.dynamic;
}

// Enhanced Cache First strategy for static assets
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse && !isExpired(cachedResponse, CACHE_CONFIG.staticAssets.maxAge)) {
    // Update cache in background for fresh content
    updateCacheInBackground(request, cache);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network request failed:', error);
    // Return cached version even if expired when network fails
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Enhanced Network First strategy for API calls
async function networkFirst(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache the successful response with edge headers
      const responseToCache = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...networkResponse.headers,
          'x-edge-cached': 'false',
          'x-edge-timestamp': Date.now().toString(),
        },
      });
      cache.put(request, responseToCache);
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network request failed, serving from cache:', error);
    if (cachedResponse) {
      // Add edge header to indicate cached response
      const cachedResponseWithHeaders = new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: {
          ...cachedResponse.headers,
          'x-edge-cached': 'true',
          'x-edge-fallback': 'network-failure',
        },
      });
      return cachedResponseWithHeaders;
    }
    throw error;
  }
}

// Enhanced Stale While Revalidate strategy for dynamic content
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Always try to update the cache in the background with edge optimization
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        const responseToCache = new Response(networkResponse.body, {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers: {
            ...networkResponse.headers,
            'x-edge-cached': 'false',
            'x-edge-updated': Date.now().toString(),
          },
        });
        cache.put(request, responseToCache);
      }
      return networkResponse;
    })
    .catch((error) => {
      console.error('[SW] Background fetch failed:', error);
    });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    // Add edge header to indicate stale content
    const cachedResponseWithHeaders = new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: {
        ...cachedResponse.headers,
        'x-edge-cached': 'true',
        'x-edge-stale': 'true',
      },
    });
    return cachedResponseWithHeaders;
  }
  
  // Otherwise wait for the network
  return await fetchPromise;
}

// Edge First strategy for edge-optimized content
async function edgeFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse && !isExpired(cachedResponse, CACHE_CONFIG.pages.maxAge)) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...networkResponse.headers,
          'x-edge-optimized': 'true',
          'x-edge-region': detectEdgeRegion(),
        },
      });
      cache.put(request, responseToCache);
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Edge request failed:', error);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Enhanced offline fallback with edge optimization
async function getOfflineResponse(request) {
  const url = new URL(request.url);
  
  // Return cached page for navigation requests
  if (request.mode === 'navigate') {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedPage = await cache.match('/');
    if (cachedPage) {
      return cachedPage;
    }
    
    // Return enhanced offline page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - QuantForge AI</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 2rem; background: #f8fafc; }
            .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
            .message { color: #64748b; margin-bottom: 2rem; }
            .retry-btn { 
              background: #3b82f6; 
              color: white; 
              border: none; 
              padding: 0.75rem 1.5rem; 
              border-radius: 0.5rem; 
              cursor: pointer;
              font-weight: 500;
            }
            .retry-btn:hover { background: #2563eb; }
            .edge-info { 
              margin-top: 2rem; 
              font-size: 0.875rem; 
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="offline-icon">📡</div>
          <h1>You're Offline</h1>
          <p class="message">Please check your internet connection and try again.</p>
          <button class="retry-btn" onclick="window.location.reload()">Retry Connection</button>
          <div class="edge-info">
            <p>QuantForge AI Edge Cache Active</p>
            <p>Some features may be available offline</p>
          </div>
        </body>
      </html>
    `, {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    });
  }
  
  // Return offline fallback for API requests
  if (url.pathname.includes('/api/')) {
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'No network connection available',
        edgeCache: true,
        timestamp: Date.now()
      }),
      {
        status: 503,
        headers: { 
          'Content-Type': 'application/json',
          'x-edge-offline': 'true'
        }
      }
    );
  }
  
  // Default offline response
  return new Response('Offline - Edge Cache Active', { 
    status: 503,
    headers: { 'x-edge-offline': 'true' }
  });
}

// Enhanced Background Sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-robots') {
    event.waitUntil(syncRobotsData());
  }
  
  if (event.tag === 'background-sync-trading-data') {
    event.waitUntil(syncTradingData());
  }
  
  if (event.tag === 'background-sync-user-preferences') {
    event.waitUntil(syncUserPreferences());
  }
  
  if (event.tag === 'background-sync-analytics') {
    event.waitUntil(syncAnalyticsData());
  }
});

async function syncRobotsData() {
  try {
    // Get pending robot operations from IndexedDB
    const pendingOperations = await getPendingOperations('robots');
    const results = [];
    
    for (const operation of pendingOperations) {
      try {
        const response = await fetch(operation.url, {
          method: operation.method,
          headers: operation.headers,
          body: operation.body
        });
        
        if (response.ok) {
          await removePendingOperation(operation.id);
          results.push({ success: true, operation: operation.id });
          console.log('[SW] Synced robot operation:', operation.id);
        } else {
          results.push({ success: false, operation: operation.id, error: response.status });
        }
      } catch (error) {
        console.error('[SW] Failed to sync robot operation:', operation.id, error);
        results.push({ success: false, operation: operation.id, error: error.message });
      }
    }
    
    // Notify clients about sync results
    notifyClients('sync-complete', { type: 'robots', results });
    return results;
  } catch (error) {
    console.error('[SW] Robot background sync failed:', error);
    throw error;
  }
}

async function syncTradingData() {
  try {
    // Sync trading strategies, backtest results, and market data
    const tradingData = await getPendingOperations('trading');
    const results = [];
    
    for (const data of tradingData) {
      try {
        const response = await fetch(`/api/trading/${data.type}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-background-sync': 'true'
          },
          body: JSON.stringify(data.payload)
        });
        
        if (response.ok) {
          await removePendingOperation(data.id);
          results.push({ success: true, operation: data.id });
        } else {
          results.push({ success: false, operation: data.id, error: response.status });
        }
      } catch (error) {
        results.push({ success: false, operation: data.id, error: error.message });
      }
    }
    
    notifyClients('sync-complete', { type: 'trading', results });
    return results;
  } catch (error) {
    console.error('[SW] Trading data sync failed:', error);
    throw error;
  }
}

async function syncUserPreferences() {
  try {
    // Sync user settings and preferences
    const preferences = await getPendingOperations('preferences');
    const results = [];
    
    for (const preference of preferences) {
      try {
        const response = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-background-sync': 'true'
          },
          body: JSON.stringify(preference.data)
        });
        
        if (response.ok) {
          await removePendingOperation(preference.id);
          results.push({ success: true, operation: preference.id });
        } else {
          results.push({ success: false, operation: preference.id, error: response.status });
        }
      } catch (error) {
        results.push({ success: false, operation: preference.id, error: error.message });
      }
    }
    
    notifyClients('sync-complete', { type: 'preferences', results });
    return results;
  } catch (error) {
    console.error('[SW] User preferences sync failed:', error);
    throw error;
  }
}

async function syncAnalyticsData() {
  try {
    // Sync analytics and performance data
    const analyticsData = await getPendingOperations('analytics');
    const results = [];
    
    // Batch analytics data for efficiency
    const batchedData = analyticsData.reduce((batches, item) => {
      const lastBatch = batches[batches.length - 1];
      if (!lastBatch || lastBatch.length >= 10) {
        batches.push([item]);
      } else {
        lastBatch.push(item);
      }
      return batches;
    }, []);
    
    for (const batch of batchedData) {
      try {
        const response = await fetch('/api/analytics/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-background-sync': 'true'
          },
          body: JSON.stringify({ events: batch.map(item => item.payload) })
        });
        
        if (response.ok) {
          for (const item of batch) {
            await removePendingOperation(item.id);
          }
          results.push({ success: true, operations: batch.map(item => item.id) });
        } else {
          results.push({ success: false, operations: batch.map(item => item.id), error: response.status });
        }
      } catch (error) {
        results.push({ success: false, operations: batch.map(item => item.id), error: error.message });
      }
    }
    
    notifyClients('sync-complete', { type: 'analytics', results });
    return results;
  } catch (error) {
    console.error('[SW] Analytics sync failed:', error);
    throw error;
  }
}

// IndexedDB operations for pending sync data
async function getPendingOperations(type) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('quanforge-sync-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pending-operations'], 'readonly');
      const store = transaction.objectStore('pending-operations');
      const index = store.index('type');
      const getRequest = index.getAll(type);
      
      getRequest.onsuccess = () => resolve(getRequest.result || []);
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pending-operations')) {
        const store = db.createObjectStore('pending-operations', { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

async function removePendingOperation(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('quanforge-sync-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pending-operations'], 'readwrite');
      const store = transaction.objectStore('pending-operations');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve(deleteRequest.result);
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Enhanced notification system for sync events
function notifyClients(type, data) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type,
        data,
        timestamp: Date.now(),
        source: 'service-worker'
      });
    });
  });
}

// Register background sync for offline operations
async function registerBackgroundSync(tag, minInterval = 0) {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    try {
      const registration = await self.registration;
      await registration.sync.register(tag);
      console.log(`[SW] Background sync registered for tag: ${tag}`);
    } catch (error) {
      console.error(`[SW] Failed to register background sync for ${tag}:`, error);
    }
  }
}

// Enhanced periodic sync for cache updates and data synchronization
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);
  
  if (event.tag === 'cache-update') {
    event.waitUntil(updateCaches());
  }
  
  if (event.tag === 'data-sync') {
    event.waitUntil(performPeriodicDataSync());
  }
  
  if (event.tag === 'analytics-report') {
    event.waitUntil(sendAnalyticsReport());
  }
});

async function performPeriodicDataSync() {
  try {
    // Sync all types of data
    const results = await Promise.allSettled([
      syncRobotsData(),
      syncTradingData(),
      syncUserPreferences(),
      syncAnalyticsData()
    ]);
    
    console.log('[SW] Periodic data sync completed:', results);
    notifyClients('periodic-sync-complete', { results });
  } catch (error) {
    console.error('[SW] Periodic data sync failed:', error);
  }
}

async function sendAnalyticsReport() {
  try {
    // Collect performance metrics and send to analytics
    const metrics = await collectPerformanceMetrics();
    const response = await fetch('/api/analytics/performance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-periodic-sync': 'true'
      },
      body: JSON.stringify(metrics)
    });
    
    if (response.ok) {
      console.log('[SW] Analytics report sent successfully');
    }
  } catch (error) {
    console.error('[SW] Failed to send analytics report:', error);
  }
}

async function collectPerformanceMetrics() {
  const cacheNames = await caches.keys();
  const cacheMetrics = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    cacheMetrics[cacheName] = {
      entries: keys.length,
      estimatedSize: await estimateCacheSize(cache)
    };
  }
  
  return {
    timestamp: Date.now(),
    caches: cacheMetrics,
    userAgent: self.navigator.userAgent,
    platform: self.navigator.platform,
    edgeRegion: detectEdgeRegion()
  };
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
    console.log('[SW] All edge caches cleared');
  } catch (error) {
    console.error('[SW] Failed to clear edge caches:', error);
  }
}

// Helper functions for edge optimization
function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true;
  
  const cacheTime = new Date(dateHeader).getTime();
  const now = Date.now();
  return (now - cacheTime) > maxAge;
}

function detectEdgeRegion() {
  // Simplified edge region detection
  // In production, this would use actual edge detection logic
  const regions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'];
  return regions[Math.floor(Math.random() * regions.length)];
}

function updateCacheInBackground(request, cache) {
  fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse);
      }
    })
    .catch((error) => {
      console.log('[SW] Background cache update failed:', request.url);
    });
}

// Enhanced message handling for edge features
self.addEventListener('message', (event) => {
  console.log('[SW] Edge message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    event.waitUntil(updateCaches());
  }
  
  if (event.data && event.data.type === 'CACHE_CLEAR') {
    event.waitUntil(clearCaches());
  }
  
  if (event.data && event.data.type === 'EDGE_STATUS') {
    event.waitUntil(
      getEdgeStatus().then(status => {
        event.ports[0].postMessage(status);
      })
    );
  }
});

async function getEdgeStatus() {
  const cacheNames = await caches.keys();
  const status = {
    edgeOptimized: true,
    caches: {},
    region: detectEdgeRegion(),
    timestamp: Date.now()
  };
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    status.caches[cacheName] = {
      entries: keys.length,
      size: await estimateCacheSize(cache),
    };
  }
  
  return status;
}

async function estimateCacheSize(cache) {
  const keys = await cache.keys();
  let totalSize = 0;
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }
  
  return totalSize;
}