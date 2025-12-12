/**
 * Minimoomaa Noir PWA Service Worker
 * Implements caching strategies, offline support, and background sync
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Workbox manifest injection point - DO NOT REMOVE
const manifest = self.__WB_MANIFEST;

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `minimoomaa-noir-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `minimoomaa-noir-dynamic-${CACHE_VERSION}`;
const PROFILE_CACHE = `minimoomaa-noir-profiles-${CACHE_VERSION}`;

// Use manifest for precaching, or fallback to static list
const STATIC_ASSETS = manifest?.length > 0
  ? manifest.map((entry: { url: string }) => entry.url)
  : [
      '/',
      '/index.html',
      '/manifest.json',
      '/favicon.ico'
    ];

const QUEUE_DB_NAME = 'minimoomaa-noir-queue';
const QUEUE_STORE_NAME = 'outgoing-messages';
const QUEUE_DB_VERSION = 1;

interface QueuedMessage {
  id: string;
  timestamp: number;
  event: NostrEventSW;
  relayUrls: string[];
}

interface NostrEventSW {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey: string;
  id?: string;
  sig?: string;
}

/**
 * Initialize IndexedDB for message queue
 */
async function initQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB_NAME, QUEUE_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        const store = db.createObjectStore(QUEUE_STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Add message to queue
 */
async function queueMessage(message: QueuedMessage): Promise<void> {
  const db = await initQueueDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([QUEUE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE_NAME);
    const request = store.add(message);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all queued messages
 */
async function getQueuedMessages(): Promise<QueuedMessage[]> {
  const db = await initQueueDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([QUEUE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(QUEUE_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove message from queue
 */
async function dequeueMessage(id: string): Promise<void> {
  const db = await initQueueDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([QUEUE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all queued messages
 */
async function clearQueue(): Promise<void> {
  const db = await initQueueDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([QUEUE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(STATIC_ASSETS);
      await self.skipWaiting();
    })()
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name =>
            name.startsWith('minimoomaa-noir-') &&
            !name.includes(CACHE_VERSION)
          )
          .map(name => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

/**
 * Determine caching strategy based on request
 */
function getCachingStrategy(url: URL): 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only' {
  const pathname = url.pathname;

  // Network only for WebSocket connections
  if (url.protocol === 'wss:' || url.protocol === 'ws:') {
    return 'network-only';
  }

  // Cache first for static assets
  if (
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.html') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.ttf')
  ) {
    return 'cache-first';
  }

  // Stale while revalidate for profiles and avatars
  if (
    pathname.includes('/avatar') ||
    pathname.includes('/profile') ||
    pathname.includes('/metadata')
  ) {
    return 'stale-while-revalidate';
  }

  // Network first for API calls and dynamic content
  return 'network-first';
}

/**
 * Cache-first strategy with network fallback
 */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[SW] Cache-first fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network-first strategy with cache fallback
 */
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache...');
    const cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stale-while-revalidate strategy
 */
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(cacheName);
      cache.then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => {
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503 });
  });

  return cached || fetchPromise;
}

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const strategy = getCachingStrategy(url);

  if (strategy === 'network-only') {
    return;
  }

  event.respondWith(
    (async () => {
      switch (strategy) {
        case 'cache-first':
          return cacheFirst(event.request, STATIC_CACHE);

        case 'network-first':
          return networkFirst(event.request, DYNAMIC_CACHE);

        case 'stale-while-revalidate':
          return staleWhileRevalidate(event.request, PROFILE_CACHE);

        default:
          return fetch(event.request);
      }
    })()
  );
});

/**
 * Background sync event - process queued messages
 */
self.addEventListener('sync', (event) => {
  const syncEvent = event as ExtendableEvent & { tag: string };
  if (syncEvent.tag === 'sync-messages') {
    syncEvent.waitUntil(
      (async () => {
        console.log('[SW] Background sync triggered');

        try {
          const messages = await getQueuedMessages();

          for (const message of messages) {
            try {
              // Send message to all specified relays
              const responses = await Promise.allSettled(
                message.relayUrls.map(url =>
                  fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(['EVENT', message.event])
                  })
                )
              );

              // Remove from queue if at least one relay succeeded
              const hasSuccess = responses.some(r => r.status === 'fulfilled');
              if (hasSuccess) {
                await dequeueMessage(message.id);
              }
            } catch (error) {
              console.error('[SW] Failed to sync message:', error);
            }
          }

          // Notify clients about sync completion
          const allClients = await self.clients.matchAll();
          allClients.forEach((client: Client) => {
            client.postMessage({
              type: 'SYNC_COMPLETE',
              count: messages.length
            });
          });
        } catch (error) {
          console.error('[SW] Background sync failed:', error);
        }
      })()
    );
  }
});

/**
 * Message event - handle commands from main thread
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'QUEUE_MESSAGE':
      queueMessage(payload).then(() => {
        event.ports[0]?.postMessage({ success: true });
      }).catch((error: Error) => {
        event.ports[0]?.postMessage({ success: false, error: error.message });
      });
      break;

    case 'GET_QUEUE':
      getQueuedMessages().then(messages => {
        event.ports[0]?.postMessage({ messages });
      }).catch((error: Error) => {
        event.ports[0]?.postMessage({ error: error.message });
      });
      break;

    case 'CLEAR_QUEUE':
      clearQueue().then(() => {
        event.ports[0]?.postMessage({ success: true });
      }).catch((error: Error) => {
        event.ports[0]?.postMessage({ success: false, error: error.message });
      });
      break;

    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

/**
 * Push notification event
 */
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: data.tag || 'minimoomaa-noir',
      data: data.url
    })
  );
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const url = event.notification.data || '/';

      // Check if there's already a window open
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return (client as WindowClient).focus();
        }
      }

      // Open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }

      return undefined;
    })
  );
});

console.log('[SW] Service worker loaded');

export {};
