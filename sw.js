/**
 * AI Chat Studio - Service Worker
 * 提供離線快取和 PWA 功能
 */

const CACHE_NAME = 'ai-chat-studio-v2.0.1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
];

// 安裝事件 - 快取靜態資源
self.addEventListener('install', (event) => {
    console.log('[SW] 安裝 Service Worker');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] 快取靜態資源');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // 強制啟用新的 Service Worker
                return self.skipWaiting();
            })
    );
});

// 啟用事件 - 清除舊快取
self.addEventListener('activate', (event) => {
    console.log('[SW] 啟用 Service Worker');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] 刪除舊快取:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                // 立即控制所有頁面
                return self.clients.claim();
            })
    );
});

// 請求攔截 - 快取優先策略（靜態資源）/ 網路優先策略（API）
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // API 請求不快取，直接走網路
    if (url.pathname.includes('/chat/completions') || 
        url.hostname.includes('openai.com') ||
        url.hostname.includes('api.')) {
        return;
    }
    
    // 靜態資源使用快取優先策略
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // 背景更新快取
                    fetch(event.request)
                        .then((response) => {
                            if (response.ok) {
                                caches.open(CACHE_NAME)
                                    .then((cache) => cache.put(event.request, response));
                            }
                        })
                        .catch(() => {});
                    
                    return cachedResponse;
                }
                
                // 快取未命中，從網路獲取
                return fetch(event.request)
                    .then((response) => {
                        // 只快取成功的請求
                        if (response.ok && event.request.method === 'GET') {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(event.request, responseClone));
                        }
                        return response;
                    })
                    .catch(() => {
                        // 離線時返回離線頁面（如果有的話）
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('離線狀態', { status: 503 });
                    });
            })
    );
});

// 處理推送通知（未來擴展用）
self.addEventListener('push', (event) => {
    console.log('[SW] 收到推送通知');
    
    const options = {
        body: event.data?.text() || '您有新訊息',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now()
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('AI Chat Studio', options)
    );
});

// 處理通知點擊
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] 通知被點擊');
    
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

