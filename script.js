// --- CONFIGURATION ---
// IMPORTANT: Replace this with your own secret topic from ntfy.sh
const NTFY_TOPIC = 'ni_alerts';

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
                statusElement.textContent = 'Stream finished. Reconnecting...';
                setTimeout(connectToNtfy, 5000);
                break;
            }

            const lines = decoder.decode(value, { stream: true }).split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    try {
                        const event = JSON.parse(line);
                        handleNtfyEvent(event);
                    } catch (e) { /* Ignore incomplete JSON lines */ }
                }
            });
        }
    } catch (error) {
        console.error('Connection failed:', error);
        statusElement.textContent = 'Connection failed. Retrying...';
        setTimeout(connectToNtfy, 10000);
    }
}

function handleNtfyEvent(event) {
    if (event.event !== 'message') return;
    console.log('Received event:', event);

    // --- THIS IS THE NEW LOGIC ---
    // Check if this is a routine snapshot update
    if (event.tags && event.tags.includes('snapshot')) {
        // If it's a snapshot, just update the image source.
        if (event.attach) {
            liveFeedImg.src = `${event.attach}?t=${new Date().getTime()}`;
        }
    } else {
        // If it's anything else, treat it as a REAL alert and add it to the list!
        if (notificationsList.querySelector('.no-alerts')) {
            notificationsList.innerHTML = ''; // Clear the "No alerts yet" message
        }

        const listItem = document.createElement('li');
        const timestamp = new Date(event.time * 1000).toLocaleTimeString();
        listItem.innerHTML = `<strong>${event.title || 'Alert'} at ${timestamp}:</strong><br>${event.message}`;
        
        // We can even style it based on priority later
        if (event.priority >= 4) { // High or urgent priority
            listItem.style.borderLeftColor = '#d9534f'; // Red for danger
        }

        notificationsList.prepend(listItem);
    }
}

// Add a placeholder class to the initial li element in index.html
// so we can easily remove it.
document.addEventListener('DOMContentLoaded', () => {
    if (notificationsList.children.length === 1) {
        notificationsList.children[0].classList.add('no-alerts');
    }
    connectToNtfy();
});
