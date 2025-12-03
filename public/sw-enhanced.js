/**
 * Enhanced Service Worker for Edge Deployment
 * Provides advanced caching, offline support, and performance optimization
 */

const CACHE_NAME = 'quanforge-edge-v2';
const STATIC_CACHE = 'quanforge-static-v2';
const API_CACHE = 'quanforge-api-v2';
const DYNAMIC_CACHE = 'quanforge-dynamic-v2';

// Cache strategies with enhanced configuration
const CACHE_STRATEGIES = {
  STATIC: {
    cacheName: STATIC_CACHE,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    maxEntries: 100
  },
  API: {
    cacheName: API_CACHE,
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 50
  },
  DYNAMIC: {
    cacheName: DYNAMIC_CACHE,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    maxEntries: 200
  }
};

// Critical assets to cache immediately
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/js/main.js',
  '/assets/css/main.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/robots',
  '/api/strategies',
  '/api/health',
  '/api/analytics/performance-score'
];

// Cache duration settings (in seconds)
const CACHE_DURATIONS = {
  static: 31536000, // 1 year
  api: 300, // 5 minutes
  dynamic: 1800 // 30 minutes
};

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('Enhanced Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache critical assets
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('Caching critical assets...');
        return cache.addAll(CRITICAL_ASSETS);
      }),
      
      // Pre-cache API responses
      caches.open(API_CACHE).then((cache) => {
        console.log('Pre-caching API endpoints...');
        return Promise.all(
          API_ENDPOINTS.map(endpoint => 
            fetch(endpoint).then(response => {
              if (response.ok) {
                return cache.put(endpoint, response);
              }
            }).catch(() => {
              // Ignore failures for pre-caching
            })
          )
        );
      })
    ]).then(() => {
      console.log('Enhanced Service Worker installed successfully');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Enhanced Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old versions of caches
          if (cacheName !== STATIC_CACHE && 
              cacheName !== API_CACHE && 
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Enhanced Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - implement advanced caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different request types
  if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isAPIRequest(request.url)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isNavigationRequest(request.url)) {
    event.respondWith(handleNavigationRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

// Handle API requests with network-first strategy
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE);
  const url = new URL(request.url);
  
  try {
    // Try network first for API requests
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('API request failed, trying cache:', error);
    
    // Fallback to cache
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Add stale-while-revalidate header
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Served-By', 'cache');
      headers.set('X-Cache-Status', 'stale');
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers
      });
    }
    
    // Return offline response for API failures
    return new Response(JSON.stringify({ 
      error: 'Offline', 
      message: 'No network connection available' 
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Return cached version immediately
    return cachedResponse;
  }
  
  try {
    // Fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the response
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('Static asset fetch failed:', error);
    
    // Try to find a fallback
    const fallbackResponse = await cache.match('/offline.html');
    return fallbackResponse || new Response('Offline', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Handle navigation requests (page loads)
async function handleNavigationRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache HTML responses
      if (networkResponse.headers.get('Content-Type')?.includes('text/html')) {
        cache.put(request, networkResponse.clone());
      }
      
      return networkResponse;
    }
  } catch (error) {
    console.warn('Navigation request failed, trying cache:', error);
  }
  
  // Fallback to cached version
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Fallback to index.html for SPA routing
  const indexResponse = await cache.match('/index.html');
  
  if (indexResponse) {
    return indexResponse;
  }
  
  // Final fallback
  return new Response('Offline', { 
    status: 503, 
    statusText: 'Service Unavailable' 
  });
}

// Handle dynamic requests with stale-while-revalidate
async function handleDynamicRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Always try to fetch from network
  const networkPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      // Cache the response
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch((error) => {
    console.warn('Dynamic request failed:', error);
    return null;
  });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    // Add stale-while-revalidate header
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-Served-By', 'cache');
    headers.set('X-Cache-Status', 'stale');
    
    // Revalidate in background
    networkPromise.then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        console.log('Background revalidation successful for:', request.url);
      }
    });
    
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers
    });
  }
  
  // Wait for network if no cache available
  try {
    const networkResponse = await networkPromise;
    
    if (networkResponse) {
      return networkResponse;
    }
  } catch (error) {
    console.warn('Network request failed:', error);
  }
  
  // Return offline response
  return new Response('Offline', { 
    status: 503, 
    statusText: 'Service Unavailable' 
  });
}

// Helper functions
function isStaticAsset(url) {
  return url.includes('/assets/') || 
         url.includes('/fonts/') || 
         url.includes('/images/') ||
         url.match(/\.(css|js|woff|woff2|ttf|otf|png|jpg|jpeg|gif|svg|webp|avif)$/);
}

function isAPIRequest(url) {
  return url.includes('/api/') || url.includes('/supabase/');
}

function isNavigationRequest(url) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Sync offline data
    const cache = await caches.open(DYNAMIC_CACHE);
    const offlineRequests = await cache.match('/offline-requests');
    
    if (offlineRequests) {
      const requests = await offlineRequests.json();
      
      for (const requestData of requests) {
        try {
          await fetch(requestData.url, requestData.options);
          console.log('Synced request:', requestData.url);
        } catch (error) {
          console.error('Failed to sync request:', error);
        }
      }
      
      // Clear synced requests
      await cache.delete('/offline-requests');
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      },
      actions: [
        {
          action: 'explore',
          title: 'Explore',
          icon: '/images/checkmark.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/images/xmark.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification('QuantForge AI', options)
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periodic background sync for cache updates
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic sync triggered:', event.tag);
  
  if (event.tag === 'cache-update') {
    event.waitUntil(updateCaches());
  }
});

async function updateCaches() {
  try {
    // Update critical assets
    const staticCache = await caches.open(STATIC_CACHE);
    
    for (const asset of CRITICAL_ASSETS) {
      try {
        const response = await fetch(asset);
        if (response.ok) {
          await staticCache.put(asset, response);
          console.log('Updated asset:', asset);
        }
      } catch (error) {
        console.warn('Failed to update asset:', asset, error);
      }
    }
    
    // Update API cache
    const apiCache = await caches.open(API_CACHE);
    
    for (const endpoint of API_ENDPOINTS) {
      try {
        const response = await fetch(endpoint);
        if (response.ok) {
          await apiCache.put(endpoint, response);
          console.log('Updated API endpoint:', endpoint);
        }
      } catch (error) {
        console.warn('Failed to update API endpoint:', endpoint, error);
      }
    }
    
    console.log('Cache update completed');
  } catch (error) {
    console.error('Cache update failed:', error);
  }
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  console.log('Message received in service worker:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    updateCaches();
  }
  
  if (event.data && event.data.type === 'CACHE_CLEAR') {
    clearAllCaches();
  }
});

async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    
    console.log('All caches cleared');
  } catch (error) {
    console.error('Failed to clear caches:', error);
  }
}

// Performance monitoring
self.addEventListener('fetch', (event) => {
  const start = performance.now();
  
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        const duration = performance.now() - start;
        
        // Log slow requests
        if (duration > 1000) {
          console.warn(`Slow request detected: ${event.request.url} took ${duration.toFixed(2)}ms`);
        }
        
        return response;
      } catch (error) {
        const duration = performance.now() - start;
        console.error(`Request failed after ${duration.toFixed(2)}ms:`, error);
        throw error;
      }
    })()
  );
});

console.log('Enhanced Service Worker loaded successfully');