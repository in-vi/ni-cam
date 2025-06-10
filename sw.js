// This script is intentionally simple. 
// It listens for push events and shows a notification.
// ntfy.sh does the heavy lifting.

self.addEventListener('push', event => {
    const data = event.data.json();
    const title = data.title || 'AI Baby Monitor';
    const options = {
        body: data.message,
        icon: data.icon || 'icons/icon-192x192.png' // Use your icon
    };
    event.waitUntil(self.registration.showNotification(title, options));
});
