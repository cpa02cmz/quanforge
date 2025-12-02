/**
 * Enhanced Service Worker for Edge Optimization
 * Provides advanced caching strategies and offline functionality
 */

const CACHE_NAME = 'quanforge-edge-v1';
const STATIC_CACHE_NAME = 'quanforge-static-v1';
const API_CACHE_NAME = 'quanforge-api-v1';
const DYNAMIC_CACHE_NAME = 'quanforge-dynamic-v1';

// Cache strategies
const CACHE_STRATEGIES = {
  STATIC: ['cache-first'],
  API: ['network-first', 'stale-while-revalidate'],
  DYNAMIC: ['stale-while-revalidate']
};

// Critical resources to cache immediately
const CRITICAL_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/js/main.js',
  '/assets/css/main.css'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/robots',
  '/api/strategies',
  '/api/health',
  '/api/edge-optimize'
];

// Cache duration settings (in seconds)
const CACHE_DURATIONS = {
  static: 31536000, // 1 year
  api: 300, // 5 minutes
  dynamic: 1800 // 30 minutes
};

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching critical resources');
        return cache.addAll(CRITICAL_RESOURCES);
      })
      .then(() => {
        console.log('Service Worker: Critical resources cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE_NAME && 
                cacheName !== API_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
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
  
  // Handle different request types
  if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isStaticResource(request)) {
    event.respondWith(handleStaticRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

// Handle API requests with network-first strategy
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful response
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      
      // Add cache header for edge optimization
      const response = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...networkResponse.headers,
          'x-cache-status': 'network',
          'x-edge-cached': 'false',
          'cache-control': `public, max-age=${CACHE_DURATIONS.api}`
        }
      });
      
      return response;
    }
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache for API:', request.url);
  }
  
  // Fallback to cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    const response = new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: {
        ...cachedResponse.headers,
        'x-cache-status': 'cache',
        'x-edge-cached': 'true',
        'cache-control': `public, max-age=${CACHE_DURATIONS.api}`
      }
    });
    
    return response;
  }
  
  // Return offline fallback for API
  return new Response(
    JSON.stringify({ 
      error: 'Offline', 
      message: 'No network connection and no cached data available',
      timestamp: Date.now()
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Handle static resources with cache-first strategy
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Add cache header
    const response = new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: {
        ...cachedResponse.headers,
        'x-cache-status': 'cache',
        'x-edge-cached': 'true',
        'cache-control': `public, max-age=${CACHE_DURATIONS.static}`
      }
    });
    
    // Update cache in background
    updateCacheInBackground(request);
    
    return response;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      
      const response = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...networkResponse.headers,
          'x-cache-status': 'network',
          'x-edge-cached': 'false',
          'cache-control': `public, max-age=${CACHE_DURATIONS.static}`
        }
      });
      
      return response;
    }
  } catch (error) {
    console.log('Service Worker: Network failed for static resource:', request.url);
  }
  
  return new Response('Resource not available offline', { status: 503 });
}

// Handle dynamic requests with stale-while-revalidate
async function handleDynamicRequest(request) {
  const cachedResponse = await caches.match(request);
  
  // Always try to update cache in background
  const networkPromise = updateCacheInBackground(request);
  
  if (cachedResponse) {
    const response = new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: {
        ...cachedResponse.headers,
        'x-cache-status': 'stale-while-revalidate',
        'x-edge-cached': 'true'
      }
    });
    
    return response;
  }
  
  try {
    const networkResponse = await networkPromise;
    if (networkResponse && networkResponse.ok) {
      return networkResponse;
    }
  } catch (error) {
    console.log('Service Worker: Network failed for dynamic request:', request.url);
  }
  
  return new Response('Resource not available', { status: 503 });
}

// Update cache in background
async function updateCacheInBackground(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      
      return new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...networkResponse.headers,
          'x-cache-status': 'network',
          'x-edge-cached': 'false'
        }
      });
    }
  } catch (error) {
    console.log('Service Worker: Background update failed:', request.url);
  }
  
  return null;
}

// Helper functions
function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') || API_ENDPOINTS.some(endpoint => url.pathname === endpoint);
}

function isStaticResource(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.gif') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2')
  );
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Handle queued offline actions
  try {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('/api/')) {
        try {
          await fetch(request);
          await cache.delete(request);
          console.log('Service Worker: Synced request:', request.url);
        } catch (error) {
          console.log('Service Worker: Sync failed for:', request.url);
        }
      }
    }
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
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
  if (event.tag === 'cache-update') {
    event.waitUntil(updateCaches());
  }
});

async function updateCaches() {
  try {
    // Update critical resources
    const cache = await caches.open(STATIC_CACHE_NAME);
    await cache.addAll(CRITICAL_RESOURCES);
    
    // Update API cache
    const apiCache = await caches.open(API_CACHE_NAME);
    for (const endpoint of API_ENDPOINTS) {
      try {
        const response = await fetch(endpoint);
        if (response.ok) {
          await apiCache.put(endpoint, response);
        }
      } catch (error) {
        console.log('Service Worker: Failed to update API cache for:', endpoint);
      }
    }
    
    console.log('Service Worker: Caches updated successfully');
  } catch (error) {
    console.error('Service Worker: Cache update failed:', error);
  }
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    event.waitUntil(updateCaches());
  }
  
  if (event.data && event.data.type === 'CACHE_CLEAR') {
    event.waitUntil(clearAllCaches());
  }
});

async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('Service Worker: All caches cleared');
  } catch (error) {
    console.error('Service Worker: Failed to clear caches:', error);
  }
}