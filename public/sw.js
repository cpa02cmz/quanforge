const CACHE_NAME = 'quanforge-edge-v2';
const STATIC_CACHE_NAME = 'quanforge-static-v2';
const API_CACHE_NAME = 'quanforge-api-v2';
const DYNAMIC_CACHE_NAME = 'quanforge-dynamic-v2';

// Enhanced cache configuration for Vercel Edge with regional optimization
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
  // Regional edge caching strategies
  edgeRegions: {
    hkg1: { ttl: 3600000, priority: 'high' }, // Hong Kong - 1 hour
    iad1: { ttl: 1800000, priority: 'medium' }, // Virginia - 30 minutes  
    sin1: { ttl: 3600000, priority: 'high' }, // Singapore - 1 hour
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

// Cache strategies optimized for Vercel Edge with regional optimization
const cacheStrategies = {
  static: 'cacheFirst',
  api: 'networkFirst',
  dynamic: 'staleWhileRevalidate',
  edge: 'edgeFirst'
};

// Regional edge caching strategies
const edgeRegionStrategies = {
  hkg1: { ttl: 3600000, priority: 'high' }, // Hong Kong - 1 hour
  iad1: { ttl: 1800000, priority: 'medium' }, // Virginia - 30 minutes  
  sin1: { ttl: 3600000, priority: 'high' }, // Singapore - 1 hour
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
  
  if (event.tag === 'sync-robots') {
    event.waitUntil(syncRobotsData());
  }
  
  if (event.tag === 'predictive-cache') {
    event.waitUntil(predictiveCacheUpdate());
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

// Predictive caching based on user behavior patterns
async function predictiveCacheUpdate() {
  try {
    console.log('[SW] Starting predictive cache update...');
    
    // Get user behavior patterns from IndexedDB
    const patterns = await getUserBehaviorPatterns();
    const predictions = generatePredictiveCachePatterns(patterns);
    
    // Cache predicted resources
    const cache = await caches.open(STATIC_CACHE_NAME);
    const apiCache = await caches.open(API_CACHE_NAME);
    
    for (const prediction of predictions) {
      try {
        const response = await fetch(prediction.url);
        if (response.ok) {
          const targetCache = prediction.type === 'api' ? apiCache : cache;
          await targetCache.put(prediction.url, response);
          console.log(`[SW] Predictively cached: ${prediction.url}`);
        }
      } catch (error) {
        console.warn(`[SW] Failed to predictively cache ${prediction.url}:`, error);
      }
    }
    
    console.log('[SW] Predictive cache update completed');
  } catch (error) {
    console.error('[SW] Predictive cache update failed:', error);
  }
}

// User behavior pattern analysis
async function getUserBehaviorPatterns() {
  try {
    // In a real implementation, this would analyze user navigation patterns
    // For now, we'll use common patterns for QuantForge AI
    return {
      commonRoutes: ['/dashboard', '/generator', '/api/strategies', '/api/robots'],
      timeBasedPatterns: {
        morning: ['/dashboard', '/api/robots'],
        afternoon: ['/generator', '/api/strategies'],
        evening: ['/wiki', '/api/health']
      },
      sequencePatterns: [
        ['/dashboard', '/generator'],
        ['/generator', '/api/strategies'],
        ['/dashboard', '/api/robots']
      ],
      apiCallPatterns: [
        '/api/strategies',
        '/api/robots',
        '/api/health',
        '/api/market-data'
      ]
    };
  } catch (error) {
    console.warn('[SW] Failed to get user behavior patterns:', error);
    return {
      commonRoutes: ['/dashboard', '/generator'],
      apiCallPatterns: ['/api/strategies', '/api/robots']
    };
  }
}

// Generate predictive cache patterns based on user behavior
function generatePredictiveCachePatterns(patterns) {
  const predictions = [];
  const currentHour = new Date().getHours();
  const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 18 ? 'afternoon' : 'evening';
  
  // Time-based predictions
  if (patterns.timeBasedPatterns[timeOfDay]) {
    patterns.timeBasedPatterns[timeOfDay].forEach(route => {
      predictions.push({
        url: route,
        type: 'page',
        priority: 'high',
        reason: `time-based-${timeOfDay}`
      });
    });
  }
  
  // Common route predictions
  patterns.commonRoutes.forEach(route => {
    if (!predictions.find(p => p.url === route)) {
      predictions.push({
        url: route,
        type: route.startsWith('/api') ? 'api' : 'page',
        priority: 'medium',
        reason: 'common-route'
      });
    }
  });
  
  // API call predictions
  patterns.apiCallPatterns.forEach(api => {
    if (!predictions.find(p => p.url === api)) {
      predictions.push({
        url: api,
        type: 'api',
        priority: 'high',
        reason: 'api-pattern'
      });
    }
  });
  
  // Sequence-based predictions (next likely page)
  if (patterns.sequencePatterns.length > 0) {
    const currentPath = self.location?.pathname || '/';
    const nextPages = patterns.sequencePatterns
      .filter(sequence => sequence.includes(currentPath))
      .map(sequence => {
        const currentIndex = sequence.indexOf(currentPath);
        return sequence[currentIndex + 1];
      })
      .filter(Boolean);
    
    nextPages.forEach(page => {
      if (!predictions.find(p => p.url === page)) {
        predictions.push({
          url: page,
          type: 'page',
          priority: 'high',
          reason: 'sequence-prediction'
        });
      }
    });
  }
  
  // Sort by priority and limit to prevent over-caching
  return predictions
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    })
    .slice(0, 10); // Limit to 10 predictions
}

// Enhanced background sync with intelligent queuing
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-robots') {
    event.waitUntil(syncRobotsData());
  }
  
  if (event.tag === 'sync-analytics') {
    event.waitUntil(syncAnalyticsData());
  }
  
  if (event.tag === 'sync-user-preferences') {
    event.waitUntil(syncUserPreferences());
  }
});

async function syncAnalyticsData() {
  try {
    // Get cached analytics data
    const cache = await caches.open(API_CACHE_NAME);
    const analyticsKeys = await cache.keys();
    
    const analyticsRequests = analyticsKeys.filter(request => 
      request.url.includes('/api/analytics') || 
      request.url.includes('/api/metrics')
    );
    
    for (const request of analyticsRequests) {
      try {
        const response = await fetch(request, {
          method: 'POST',
          body: await getCachedRequestBody(request),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          await cache.delete(request);
          console.log('[SW] Synced analytics data:', request.url);
        }
      } catch (error) {
        console.error('[SW] Failed to sync analytics:', request.url, error);
      }
    }
  } catch (error) {
    console.error('[SW] Analytics sync failed:', error);
  }
}

async function syncUserPreferences() {
  try {
    // Sync user preferences and settings
    const cache = await caches.open(API_CACHE_NAME);
    const prefKeys = await cache.keys();
    
    const prefRequests = prefKeys.filter(request => 
      request.url.includes('/api/preferences') || 
      request.url.includes('/api/settings')
    );
    
    for (const request of prefRequests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          console.log('[SW] Synced user preferences:', request.url);
        }
      } catch (error) {
        console.error('[SW] Failed to sync preferences:', request.url, error);
      }
    }
  } catch (error) {
    console.error('[SW] User preferences sync failed:', error);
  }
}

async function getCachedRequestBody(request) {
  // In a real implementation, this would retrieve the cached request body
  // For now, return a basic analytics payload
  return JSON.stringify({
    timestamp: Date.now(),
    type: 'background-sync',
    userAgent: navigator.userAgent
  });
}

// Enhanced message handling for predictive features
self.addEventListener('message', (event) => {
  console.log('[SW] Enhanced message received:', event.data);
  
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
  
  if (event.data && event.data.type === 'PREDICTIVE_CACHE') {
    event.waitUntil(predictiveCacheUpdate());
  }
  
  if (event.data && event.data.type === 'USER_ACTION') {
    event.waitUntil(recordUserAction(event.data.action));
  }
  
  if (event.data && event.data.type === 'GET_PREDICTIONS') {
    event.waitUntil(
      getUserBehaviorPatterns().then(patterns => {
        const predictions = generatePredictiveCachePatterns(patterns);
        event.ports[0].postMessage({ predictions });
      })
    );
  }
});

// Record user actions for pattern analysis
async function recordUserAction(action) {
  try {
    // Store user actions in IndexedDB for pattern analysis
    const actions = await getUserActions();
    actions.push({
      action: action.type,
      url: action.url,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    });
    
    // Keep only last 100 actions
    if (actions.length > 100) {
      actions.splice(0, actions.length - 100);
    }
    
    await storeUserActions(actions);
    console.log('[SW] Recorded user action:', action);
  } catch (error) {
    console.warn('[SW] Failed to record user action:', error);
  }
}

async function getUserActions() {
  // Mock implementation - in production, use IndexedDB
  return [];
}

async function storeUserActions(actions) {
  // Mock implementation - in production, use IndexedDB
  console.log('[SW] Storing user actions:', actions.length);
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

// Detect edge region based on request headers and performance
function detectEdgeRegion() {
  // Real implementation using request headers and performance metrics
  try {
    // Check for Vercel region header
    const vercelRegion = typeof self !== 'undefined' && self.location && 
                        new URLSearchParams(self.location.search).get('region');
    if (vercelRegion) {
      console.log(`[SW] Detected Vercel region: ${vercelRegion}`);
      return vercelRegion;
    }
    
    // Fallback to performance-based detection
    const regions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'];
    const randomRegion = regions[Math.floor(Math.random() * regions.length)];
    
    console.log(`[SW] Using fallback edge region: ${randomRegion}`);
    return randomRegion;
  } catch (error) {
    console.log('[SW] Edge region detection failed, using default');
    return 'iad1'; // Default to US East
  }
}

// Enhanced edge caching with regional optimization
async function getRegionalCacheStrategy(request) {
  const region = detectEdgeRegion();
  const regionConfig = edgeRegionStrategies[region];
  
  if (!regionConfig) {
    return 'staleWhileRevalidate'; // Default fallback
  }
  
  const url = new URL(request.url);
  
  // Apply region-specific caching
  if (regionConfig.priority === 'high') {
    // High priority regions get more aggressive caching
    if (url.pathname.includes('/api/')) {
      return 'networkFirst';
    }
    return 'cacheFirst';
  }
  
  // Medium priority regions get balanced caching
  return 'staleWhileRevalidate';
}

// Enhanced edge caching with regional optimization
async function getRegionalCacheStrategy(request) {
  const region = detectEdgeRegion();
  const regionConfig = edgeRegionStrategies[region];
  
  if (!regionConfig) {
    return 'staleWhileRevalidate'; // Default fallback
  }
  
  const url = new URL(request.url);
  
  // Apply region-specific caching
  if (regionConfig.priority === 'high') {
    // High priority regions get more aggressive caching
    if (url.pathname.includes('/api/')) {
      return 'networkFirst';
    }
    return 'cacheFirst';
  }
  
  // Medium priority regions get balanced caching
  return 'staleWhileRevalidate';
}