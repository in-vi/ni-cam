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
                console.log("Stream finished. Reconnecting...");
                statusElement.textContent = 'Stream finished. Reconnecting...';
                setTimeout(connectToNtfy, 5000);
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            // --- DEBUG LINE 1 ---
            console.log("Raw chunk received from server:", chunk);

            const lines = chunk.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    try {
                        const event = JSON.parse(line);
                        // --- DEBUG LINE 2 ---
                        console.log("Successfully parsed JSON event:", event);
                        handleNtfyEvent(event);
                    } catch (e) {
                        console.error("Failed to parse JSON line:", line, e);
                    }
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
    // --- DEBUG LINE 3 ---
    console.log("Processing event in handleNtfyEvent function:", event);

    if (event.event !== 'message') {
        console.log("Event ignored because it's not a 'message' event.");
        return;
    }

    if (event.tags && event.tags.includes('snapshot')) {
        console.log("This is a 'snapshot' event. Updating image.");
        if (event.attach) {
            liveFeedImg.src = event.attach; // No need for timestamp with data URIs or unique URLs
        } else {
            console.warn("Snapshot event received but it has no 'attach' field.");
        }
    } else {
        console.log("This is a real alert. Adding to list.");
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
