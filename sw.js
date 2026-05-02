// sw.js — Nivaan Tracker Service Worker
// Handles FCM background push messages for iOS PWA (16.4+)

importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// Firebase config is injected at runtime via postMessage from the main app,
// then stored in the SW cache so it survives restarts.
let messaging = null;

// Listen for config posted from the main page after SW activation
self.addEventListener('message', event => {
    if (event.data?.type === 'FIREBASE_CONFIG') {
        const config = event.data.config;
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        messaging = firebase.messaging();

        // Handle background messages (app closed / screen locked)
        messaging.onBackgroundMessage(payload => {
            const { title, body, icon } = payload.notification || {};
            self.registration.showNotification(title || "Nivaan's Routine", {
                body: body || '',
                icon: icon || '/icon-192.png',
                badge: '/icon-192.png',
                tag: payload.data?.taskId || 'routine-alert', // Collapses duplicates
                renotify: true,
                data: payload.data || {}
            });
        });
    }
});

// Show notification when triggered by the Cloud Function push
self.addEventListener('push', event => {
    if (!event.data) return;
    let payload;
    try { payload = event.data.json(); } catch { payload = { notification: { title: "Nivaan", body: event.data.text() } }; }

    const { title, body } = payload.notification || {};
    event.waitUntil(
        self.registration.showNotification(title || "Nivaan's Routine", {
            body: body || '',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: payload.data?.taskId || 'routine-alert',
            renotify: true,
            data: payload.data || {}
        })
    );
});

// Tapping the notification opens the PWA
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            if (list.length > 0) return list[0].focus();
            return clients.openWindow('/');
        })
    );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));
