// Service Worker for PWA functionality
const CACHE_NAME = 'geeze-bingo-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/components.css',
    '/css/responsive.css',
    '/js/app.js',
    '/js/game.js',
    '/js/socket.js',
    '/js/wallet.js',
    '/js/telegram.js',
    '/manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip socket.io requests
    if (event.request.url.includes('/socket.io/')) return;

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached response if found
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                // Make network request
                return fetch(fetchRequest).then((response) => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    // Cache the new response
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                });
            })
    );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-game-actions') {
        event.waitUntil(syncGameActions());
    }
});

async function syncGameActions() {
    // Sync any pending game actions
    const pendingActions = await getPendingActions();
    
    for (const action of pendingActions) {
        try {
            await sendActionToServer(action);
            await removePendingAction(action.id);
        } catch (error) {
            console.error('Failed to sync action:', action, error);
        }
    }
}

// Helper functions for background sync
async function getPendingActions() {
    const db = await openDatabase();
    return new Promise((resolve) => {
        const transaction = db.transaction(['pending_actions'], 'readonly');
        const store = transaction.objectStore('pending_actions');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]);
    });
}

async function removePendingAction(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pending_actions'], 'readwrite');
        const store = transaction.objectStore('pending_actions');
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BingoGameDB', 1);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object store for pending actions
            if (!db.objectStoreNames.contains('pending_actions')) {
                const store = db.createObjectStore('pending_actions', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function sendActionToServer(action) {
    // Send action to server
    const response = await fetch('/api/game/action', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(action)
    });
    
    if (!response.ok) {
        throw new Error('Failed to send action');
    }
    
    return response.json();
}

// Push notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/badge-72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            {
                action: 'open',
                title: 'Open Game'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'open') {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((windowClients) => {
                for (const client of windowClients) {
                    if (client.url === event.notification.data.url && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url);
                }
            })
        );
    }
});
