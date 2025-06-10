// --- CONFIGURATION ---
const NTFY_TOPIC = 'ni_alerts'; // Make sure this is correct
// -------------------

const statusElement = document.getElementById('status');
const liveFeedImg = document.getElementById('live-feed-img');
const notificationsList = document.getElementById('notifications-list');

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker registered.', reg))
        .catch(err => console.error('Service Worker registration failed:', err));
}

async function connectToNtfy() {
    statusElement.textContent = 'Connecting to notification stream...';
    try {
        const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}/json`);
        statusElement.textContent = '✅ Connected and monitoring.';
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                setTimeout(connectToNtfy, 5000);
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    try {
                        const event = JSON.parse(line);
                        handleNtfyEvent(event);
                    } catch (e) { /* Ignore incomplete JSON */ }
                }
            });
        }
    } catch (error) {
        setTimeout(connectToNtfy, 10000);
    }
}

function handleNtfyEvent(event) {
    if (event.event !== 'message') {
        return; // Ignore 'open' and 'keepalive' events
    }

    // Check if it's a routine snapshot update
    if (event.tags && event.tags.includes('snapshot')) {
        
        // --- THIS IS THE FIX ---
        // We look for event.attachment, which is an object,
        // and get the .url property from inside it.
        if (event.attachment && event.attachment.url) {
            liveFeedImg.src = event.attachment.url;
        }
        
    } else {
        // Otherwise, it's a real alert for the list
        if (notificationsList.querySelector('.no-alerts')) {
            notificationsList.innerHTML = '';
        }
        const listItem = document.createElement('li');
        const timestamp = new Date(event.time * 1000).toLocaleTimeString();
        listItem.innerHTML = `<strong>${event.title || 'Alert'} at ${timestamp}:</strong><br>${event.message}`;
        if (event.priority >= 4) {
            listItem.style.borderLeftColor = '#d9534f';
        }
        notificationsList.prepend(listItem);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (notificationsList.children.length === 1) {
        notificationsList.children[0].classList.add('no-alerts');
    }
    connectToNtfy();
});
